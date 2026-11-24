import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable } from 'rxjs';
import { AuditService } from './audit.service';
/**
 * Global interceptor; active only on handlers decorated with @Audit(...).
 * After success it writes { action, resourceType, resourceId, before, after } where
 * `before` comes from RequestContext.setAuditBefore() (call it in the service before mutating)
 * and `after` is the handler's response body.
 * For multi-step mutations prefer AuditService.record(..., tx) inside the transaction.
 */
export declare class AuditInterceptor implements NestInterceptor {
    private readonly reflector;
    private readonly audit;
    constructor(reflector: Reflector, audit: AuditService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
}
