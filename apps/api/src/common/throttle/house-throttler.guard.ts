import { Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
  type ThrottlerModuleOptions,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import type { Request } from 'express';
import type { Principal } from '../auth/principal';
import {
  resolveSessionOnce,
  SESSION_RESOLVER,
  type SessionResolver,
} from '../auth/session-resolver';

/** Bucket key for a resolved principal: one bucket per account, not per shared IP. */
export function principalTracker(principal: Principal): string {
  return principal.kind === 'ADMIN' ? `admin:${principal.adminId}` : `user:${principal.userId}`;
}

/**
 * ThrottlerGuard keyed by account when the request carries a valid session, else by client IP.
 *
 * Per-IP-only keys punish users behind CGNAT (mobile carriers put many subscribers on one IP)
 * and make every SSR call from the Next.js server share one 127.0.0.1 bucket. Anonymous traffic
 * falls back to req.ip, which honours TRUST_PROXY (bootstrap/configure-app.ts parseTrustProxy).
 *
 * SSR contract (docs/CONVENTIONS.md §3): the Next.js servers call the API on 127.0.0.1 and send
 * `x-forwarded-for: <the visitor's address>` (nginx sets X-Forwarded-For to $remote_addr) plus
 * `x-house-ssr: 1`. With TRUST_PROXY=loopback, req.ip is then the visitor, so each visitor has its
 * own bucket; a remote peer's X-Forwarded-For is ignored. `x-house-ssr` is informational only and
 * grants nothing (anyone can send it through nginx). An SSR call without X-Forwarded-For (ISR
 * revalidation, build) is keyed as the loopback address and shares one bucket.
 *
 * Runs before AuthGuard; the session lookup is memoized per request so AuthGuard reuses it.
 */
@Injectable()
export class HouseThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: ThrottlerModuleOptions,
    @InjectThrottlerStorage() storage: ThrottlerStorage,
    reflector: Reflector,
    @Inject(SESSION_RESOLVER) private readonly sessions: SessionResolver,
  ) {
    super(options, storage, reflector);
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const session = await resolveSessionOnce(req as unknown as Request, this.sessions);
    if (session) return principalTracker(session.principal);
    return `ip:${await super.getTracker(req)}`;
  }
}
