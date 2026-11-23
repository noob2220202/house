import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PATH_METADATA } from '@nestjs/common/constants';
import { HEADER_NAMES } from '@house/shared';
import type { Request } from 'express';
import type Redis from 'ioredis';
import { defer, from, mergeMap, type Observable } from 'rxjs';
import { AuditService } from '../../../common/audit/audit.service';
import { isAdminPath } from '../../../common/auth/session-resolver';
import { RequestContext } from '../../../common/context/request-context';
import { AUDIT_KEY } from '../../../common/decorators/metadata-keys';
import { PrismaService } from '../../../prisma/prisma.service';
import { InjectRedis } from '../../../redis/redis.constants';
import { AUDIT_REQUEST_ID_KEY_PREFIX, AUDIT_REQUEST_ID_TTL_SECONDS } from '../constants';

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
 * for the others, if the handler did not write an audit row itself (AuditService.record(…, tx),
 * matched by request id), a generic row `auto:<resource>.<handler>` is written with the route
 * params and the (secret-stripped, PII-redacted) response body.
 *
 * The request id is only a trustworthy match key when the server generated it. A client may send
 * its own `x-request-id` (accepted by the request-context middleware) and reuse it on several
 * concurrent calls, so that another call's audit row would hide this one. Every request carrying a
 * client-chosen id therefore counts itself under that id in Redis (shared by all API instances);
 * if any other request used the same id within the TTL — or Redis cannot tell — the lookup is
 * skipped and the fallback row is always written (over-auditing is the safe direction).
 */
@Injectable()
export class AdminMutationAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AdminMutationAuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();
    const requestId = RequestContext.requestId();
    // Any request may write audit rows (GET reads of PII, user flows), so each one with a
    // client-chosen id is counted, not only the admin mutations this interceptor backs up.
    const clientChosenId =
      requestId !== undefined && req.headers[HEADER_NAMES.REQUEST_ID] === requestId
        ? requestId
        : undefined;
    const fallback =
      MUTATING_METHODS.has(req.method) &&
      isAdminPath(req) &&
      !this.reflector.get(AUDIT_KEY, context.getHandler());
    if (!fallback && clientChosenId === undefined) return next.handle();

    const startedAt = new Date();
    const resourceType = resourceTypeFromPath(
      this.reflector.get<string | string[] | undefined>(PATH_METADATA, context.getClass()),
    );
    const action = `auto:${resourceType}.${context.getHandler().name}`.slice(0, 100);
    return defer(() => from(this.claim(clientChosenId))).pipe(
      mergeMap((claimedAlone) => {
        if (!fallback) return next.handle();
        return next
          .handle()
          .pipe(
            mergeMap((result: unknown) =>
              from(
                this.recordIfMissing(
                  req,
                  { action, resourceType, startedAt, clientChosenId, claimedAlone },
                  result,
                ),
              ),
            ),
          );
      }),
    );
  }

  /** Counts this request under its client-chosen id; true when it is the only one so far. */
  private async claim(clientChosenId: string | undefined): Promise<boolean> {
    if (clientChosenId === undefined) return true;
    try {
      const key = `${AUDIT_REQUEST_ID_KEY_PREFIX}${clientChosenId}`;
      const res = await this.redis
        .multi()
        .incr(key)
        .expire(key, AUDIT_REQUEST_ID_TTL_SECONDS)
        .exec();
      return res?.[0]?.[0] === null && res[0][1] === 1;
    } catch (err) {
      this.logger.warn({ err }, 'request id claim failed; fallback audit will always write');
      return false;
    }
  }

  /** Whether an audit row found under this request id can only have come from this request. */
  private async requestIdIsExclusive(meta: {
    clientChosenId: string | undefined;
    claimedAlone: boolean;
  }): Promise<boolean> {
    if (meta.clientChosenId === undefined) return true;
    if (!meta.claimedAlone) return false;
    try {
      const count = await this.redis.get(`${AUDIT_REQUEST_ID_KEY_PREFIX}${meta.clientChosenId}`);
      return count === '1';
    } catch {
      return false;
    }
  }

  private async recordIfMissing(
    req: Request,
    meta: {
      action: string;
      resourceType: string;
      startedAt: Date;
      clientChosenId: string | undefined;
      claimedAlone: boolean;
    },
    result: unknown,
  ): Promise<unknown> {
    try {
      const requestId = RequestContext.requestId();
      if (requestId && (await this.requestIdIsExclusive(meta))) {
        const existing = await this.prisma.auditLog.findFirst({
          where: { requestId, createdAt: { gte: new Date(meta.startedAt.getTime() - 1000) } },
          select: { id: true },
        });
        if (existing) return result;
      }
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
