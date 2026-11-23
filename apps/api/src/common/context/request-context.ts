import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { HEADER_NAMES } from '@house/shared';
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

const storage = new AsyncLocalStorage<RequestContextStore>();
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;

/** Per-request context (request id, ip, principal) available anywhere via AsyncLocalStorage. */
export const RequestContext = {
  current(): RequestContextStore | undefined {
    return storage.getStore();
  },
  requestId(): string | undefined {
    return storage.getStore()?.requestId;
  },
  /** Record the pre-mutation state of the resource for the audit log of this request. */
  setAuditBefore(snapshot: unknown): void {
    const store = storage.getStore();
    if (store) store.auditBefore = snapshot;
  },
  run<T>(store: RequestContextStore, fn: () => T): T {
    return storage.run(store, fn);
  },
};

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[HEADER_NAMES.REQUEST_ID];
  const requestId =
    typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
  req.id = requestId;
  res.setHeader(HEADER_NAMES.REQUEST_ID, requestId);
  const ua = req.headers['user-agent'];
  storage.run(
    { requestId, ip: req.ip, userAgent: typeof ua === 'string' ? ua.slice(0, 500) : undefined },
    () => next(),
  );
}
