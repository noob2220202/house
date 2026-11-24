import { Reflector } from '@nestjs/core';
import { ThrottlerGuard, type ThrottlerModuleOptions, type ThrottlerStorage } from '@nestjs/throttler';
import type { Principal } from '../auth/principal';
import { type SessionResolver } from '../auth/session-resolver';
/** Bucket key for a resolved principal: one bucket per account, not per shared IP. */
export declare function principalTracker(principal: Principal): string;
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
export declare class HouseThrottlerGuard extends ThrottlerGuard {
    private readonly sessions;
    constructor(options: ThrottlerModuleOptions, storage: ThrottlerStorage, reflector: Reflector, sessions: SessionResolver);
    protected getTracker(req: Record<string, unknown>): Promise<string>;
}
