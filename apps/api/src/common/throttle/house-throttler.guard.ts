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
 * still falls back to req.ip, which honours TRUST_PROXY: the SSR server must forward the
 * visitor's X-Forwarded-For (nginx sets it to $remote_addr) so loopback-trusted calls are keyed
 * by the real client.
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
