import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { from, mergeMap, type Observable } from 'rxjs';
import { RequestContext } from '../context/request-context';
import { AUDIT_KEY } from '../decorators/metadata-keys';
import type { AuditOptions } from '../decorators/audit.decorator';
import { AuditService } from './audit.service';

/**
 * Global interceptor; active only on handlers decorated with @Audit(...).
 * After success it writes { action, resourceType, resourceId, before, after } where
 * `before` comes from RequestContext.setAuditBefore() (call it in the service before mutating)
 * and `after` is the handler's response body.
 * For multi-step mutations prefer AuditService.record(..., tx) inside the transaction.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditOptions | undefined>(AUDIT_KEY, context.getHandler());
    if (!options || context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      mergeMap((result: unknown) =>
        from(
          (async () => {
            const param = req.params[options.idParam ?? 'id'];
            const resultId =
              typeof result === 'object' && result !== null && 'id' in result
                ? String(result.id)
                : undefined;
            await this.audit.record({
              action: options.action,
              resourceType: options.resourceType,
              resourceId: typeof param === 'string' ? param : resultId,
              before: RequestContext.current()?.auditBefore,
              after: result,
            });
            return result;
          })(),
        ),
      ),
    );
  }
}
