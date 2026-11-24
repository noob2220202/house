import type { NextFunction, Request, Response } from 'express';
import type { Principal } from '../auth/principal';
export interface RequestContextStore {
    requestId: string;
    ip: string | undefined;
    userAgent: string | undefined;
    principal?: Principal;
    /** Snapshot set by services before a mutation, consumed by the audit interceptor. */
    auditBefore?: unknown;
    /** Set by AuditService.record once this request wrote an audit row (admin safety net). */
    auditWritten?: boolean;
}
/** Per-request context (request id, ip, principal) available anywhere via AsyncLocalStorage. */
export declare const RequestContext: {
    current(): RequestContextStore | undefined;
    requestId(): string | undefined;
    /** Record the pre-mutation state of the resource for the audit log of this request. */
    setAuditBefore(snapshot: unknown): void;
    run<T>(store: RequestContextStore, fn: () => T): T;
};
export declare function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void;
