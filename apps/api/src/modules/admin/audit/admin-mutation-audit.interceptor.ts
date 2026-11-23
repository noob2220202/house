import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { from, mergeMap, type Observable } from 'rxjs';
import { AuditService } from '../../../common/audit/audit.service';
import { isAdminPath } from '../../../common/auth/session-resolver';
import { RequestContext } from '../../../common/context/request-context';
import { AUDIT_KEY } from '../../../common/decorators/metadata-keys';

export const MUTATING_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Response fields that must never reach the audit log (tokens, TOTP enrolment material …). */
const SECRET_KEYS = new Set([
  'csrfToken',
  'token',
  'secret',
  'otpauthUrl',
  'qrCodeDataUrl',
  'recoveryCodes',
  'password',
  'newPassword',
  'currentPassword',
]);

export function stripSecrets(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => stripSecrets(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEYS.has(k) ? (v == null ? null : '[redacted]') : stripSecrets(v, depth + 1);
  }
  return out;
}

/** "admin/agencies" → "agencies", "admin/complexes/trade-sync" → "complexes.trade-sync". */
export function resourceTypeFromPath(controllerPath: string | string[] | undefined): string {
  const path = Array.isArray(controllerPath) ? (controllerPath[0] ?? '') : (controllerPath ?? '');
  const parts = path
    .split('/')
    .filter((p) => p && !p.startsWith(':'))
    .slice(1);
  return (parts.join('.') || 'admin').slice(0, 50);
}

/**
 * Safety net behind @Audit: every successful mutation under /api/v1/admin/** ends up in the
 * audit log, whichever module owns the route. Handlers with @Audit are left to AuditInterceptor;
 * for the others, if the handler did not write an audit row itself (AuditService.record(…, tx)
 * flags the request context), a generic row `auto:<resource>.<handler>` is written with the route
 * params and the (secret-stripped, PII-redacted) response body. The flag lives in this request's
 * AsyncLocalStorage store, so a client-chosen x-request-id shared by other calls cannot hide a
 * mutation.
 */
@Injectable()
export class AdminMutationAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminMutationAuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    const fallback =
      MUTATING_METHODS.has(req.method) &&
      isAdminPath(req) &&
      !this.reflector.get(AUDIT_KEY, context.getHandler());
    if (!fallback) return next.handle();

    const resourceType = resourceTypeFromPath(
      this.reflector.get<string | string[] | undefined>(PATH_METADATA, context.getClass()),
    );
    const action = `auto:${resourceType}.${context.getHandler().name}`.slice(0, 100);
    return next
      .handle()
      .pipe(
        mergeMap((result: unknown) =>
          from(this.recordIfMissing(req, { action, resourceType }, result)),
        ),
      );
  }

  private async recordIfMissing(
    req: Request,
    meta: { action: string; resourceType: string },
    result: unknown,
  ): Promise<unknown> {
    try {
      if (RequestContext.current()?.auditWritten) return result;
      const param = req.params.id;
      const resultId =
        typeof result === 'object' && result !== null && 'id' in result
          ? String(result.id)
          : undefined;
      await this.audit.record({
        action: meta.action,
        resourceType: meta.resourceType,
        resourceId: (typeof param === 'string' ? param : resultId)?.slice(0, 64),
        before: RequestContext.current()?.auditBefore,
        after: { params: { ...req.params }, response: stripSecrets(result) },
      });
    } catch (err) {
      // The mutation already committed; a failed audit write is logged loudly, not turned into a 500.
      this.logger.error({ err, action: meta.action }, 'fallback audit write failed');
    }
    return result;
  }
}
