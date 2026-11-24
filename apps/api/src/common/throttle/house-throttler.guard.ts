import { type ExecutionContext, Inject, Injectable } from '@nestjs/common';
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

/** Header the Next.js servers add to their own server-side API calls (docs/CONVENTIONS.md §3). */
export const SSR_HEADER = 'x-house-ssr';

/** 127.0.0.0/8 and ::1, also in IPv4-mapped form (what Express' "loopback" trust covers). */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) return false;
  const v4 = address.startsWith('::ffff:') ? address.slice(7) : address;
  return address === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4);
}

/**
 * A server-side call by a Next.js server on this host: a loopback peer with `x-house-ssr: 1`
 * (cached or forwarding a visitor). nginx clears X-House-SSR on every proxied request, so a
 * browser can never produce this; listing detail reads use it to leave view counting to the
 * browser beacon (POST /listings/:id/view).
 */
export function isLocalSsrRequest(req: Request): boolean {
  return req.headers[SSR_HEADER] === '1' && isLoopbackAddress(req.socket?.remoteAddress);
}

/**
 * A cached (visitor-less) read by a Next.js server on this host: GET/HEAD from a loopback peer
 * with `x-house-ssr: 1` and no X-Forwarded-For. Next shares the response with every visitor
 * (ISR / fetch cache), so there is no client to key it by; nginx rate-limits the page requests
 * that cause these reads per visitor IP instead (zone house_pages).
 *
 * Only a process on this host can produce this combination: nginx overwrites X-Forwarded-For
 * with $remote_addr and clears X-House-SSR on every proxied request (house-proxy.conf), and a
 * remote peer is never loopback. Writes and calls that forward a visitor stay throttled.
 */
export function isLocalSsrCachedRead(req: Request): boolean {
  return (
    (req.method === 'GET' || req.method === 'HEAD') &&
    req.headers['x-forwarded-for'] === undefined &&
    isLocalSsrRequest(req)
  );
}

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
 * own bucket; a remote peer's X-Forwarded-For is ignored. Cached SSR reads, which carry the
 * marker but no visitor, are not throttled here (isLocalSsrCachedRead): one shared 127.0.0.1
 * bucket would let a single client exhaust it for every visitor of uncached pages. Any other
 * loopback call without X-Forwarded-For (image optimizer, scripts) is keyed as the loopback address.
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

  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (await super.shouldSkip(context)) return true;
    if (context.getType() !== 'http') return false;
    return isLocalSsrCachedRead(context.switchToHttp().getRequest<Request>());
  }

  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const session = await resolveSessionOnce(req as unknown as Request, this.sessions);
    if (session) return principalTracker(session.principal);
    return `ip:${await super.getTracker(req)}`;
  }
}
