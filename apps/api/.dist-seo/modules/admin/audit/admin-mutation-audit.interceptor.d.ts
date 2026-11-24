import { type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Observable } from 'rxjs';
import { AuditService } from '../../../common/audit/audit.service';
export declare const MUTATING_METHODS: ReadonlySet<string>;
export declare function stripSecrets(value: unknown, depth?: number): unknown;
/** "admin/agencies" → "agencies", "admin/complexes/trade-sync" → "complexes.trade-sync". */
export declare function resourceTypeFromPath(controllerPath: string | string[] | undefined): string;
/**
 * Safety net behind @Audit: every successful mutation under /api/v1/admin/** ends up in the
 * audit log, whichever module owns the route. Handlers with @Audit are left to AuditInterceptor;
 * for the others, if the handler did not write an audit row itself (AuditService.record(…, tx)
 * flags the request context), a generic row `auto:<resource>.<handler>` is written with the route
 * params and the (secret-stripped, PII-redacted) response body. The flag lives in this request's
 * AsyncLocalStorage store, so a client-chosen x-request-id shared by other calls cannot hide a
 * mutation.
 */
export declare class AdminMutationAuditInterceptor implements NestInterceptor {
    private readonly reflector;
    private readonly audit;
    private readonly logger;
    constructor(reflector: Reflector, audit: AuditService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
    private recordIfMissing;
}
