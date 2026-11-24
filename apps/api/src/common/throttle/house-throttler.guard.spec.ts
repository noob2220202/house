import { UserRole, AdminRole } from '@house/shared';
import { Reflector } from '@nestjs/core';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { Request } from 'express';
import type { ResolvedSession, SessionResolver } from '../auth/session-resolver';
import { resolveSessionOnce } from '../auth/session-resolver';
import {
  HouseThrottlerGuard,
  isLocalSsrCachedRead,
  isLocalSsrRequest,
  isLoopbackAddress,
  principalTracker,
} from './house-throttler.guard';

class TestGuard extends HouseThrottlerGuard {
  tracker(req: Request): Promise<string> {
    return this.getTracker(req as unknown as Record<string, unknown>);
  }
}

const userSession: ResolvedSession = {
  principal: { kind: 'USER', userId: 'u1', role: UserRole.USER, agencyId: null, sessionId: 's1' },
  csrfToken: 'c',
};

function makeGuard(session: ResolvedSession | null): { guard: TestGuard; resolve: jest.Mock } {
  const resolve = jest.fn<Promise<ResolvedSession | null>, [Request]>(async () => session);
  const resolver: SessionResolver = { resolve };
  const storage = {} as ThrottlerStorage;
  const guard = new TestGuard({ throttlers: [] }, storage, new Reflector(), resolver);
  return { guard, resolve };
}

const req = (ip: string): Request => ({ ip, headers: {} }) as unknown as Request;

describe('HouseThrottlerGuard.getTracker', () => {
  it('keys authenticated requests by account, not by IP', async () => {
    const { guard } = makeGuard(userSession);
    await expect(guard.tracker(req('100.64.0.1'))).resolves.toBe('user:u1');
  });

  it('falls back to the client IP for anonymous requests', async () => {
    const { guard } = makeGuard(null);
    await expect(guard.tracker(req('203.0.113.9'))).resolves.toBe('ip:203.0.113.9');
  });

  it('memoizes the session lookup per request so AuthGuard does not repeat it', async () => {
    const { guard, resolve } = makeGuard(userSession);
    const r = req('127.0.0.1');
    await guard.tracker(r);
    await expect(resolveSessionOnce(r, { resolve })).resolves.toBe(userSession);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('separates admin and user id spaces', () => {
    expect(
      principalTracker({
        kind: 'ADMIN',
        adminId: 'u1',
        role: AdminRole.ADMIN,
        sessionId: 's',
        mfaVerified: true,
      }),
    ).toBe('admin:u1');
    expect(principalTracker(userSession.principal)).toBe('user:u1');
  });
});

describe('isLocalSsrCachedRead (Next.js cached reads on this host)', () => {
  const ssr = (
    over: { method?: string; peer?: string; headers?: Record<string, string> } = {},
  ): Request =>
    ({
      method: over.method ?? 'GET',
      socket: { remoteAddress: over.peer ?? '127.0.0.1' },
      headers: over.headers ?? { 'x-house-ssr': '1' },
    }) as unknown as Request;

  it('matches a GET/HEAD with the marker and no visitor from loopback', () => {
    expect(isLocalSsrCachedRead(ssr())).toBe(true);
    expect(isLocalSsrCachedRead(ssr({ method: 'HEAD', peer: '::1' }))).toBe(true);
    expect(isLocalSsrCachedRead(ssr({ peer: '::ffff:127.0.0.1' }))).toBe(true);
  });

  it('never matches writes, remote peers, nginx-proxied calls or calls that forward a visitor', () => {
    expect(isLocalSsrCachedRead(ssr({ method: 'POST' }))).toBe(false);
    expect(isLocalSsrCachedRead(ssr({ peer: '203.0.113.9' }))).toBe(false);
    expect(isLocalSsrCachedRead(ssr({ peer: '::ffff:10.0.0.1' }))).toBe(false);
    expect(
      isLocalSsrCachedRead(
        ssr({ headers: { 'x-house-ssr': '1', 'x-forwarded-for': '203.0.113.9' } }),
      ),
    ).toBe(false);
    expect(isLocalSsrCachedRead(ssr({ headers: {} }))).toBe(false);
    expect(isLocalSsrCachedRead(ssr({ headers: { 'x-house-ssr': 'yes' } }))).toBe(false);
  });

  it('isLocalSsrRequest: any method, with or without a forwarded visitor, loopback + marker only', () => {
    expect(isLocalSsrRequest(ssr())).toBe(true);
    expect(
      isLocalSsrRequest(ssr({ headers: { 'x-house-ssr': '1', 'x-forwarded-for': '203.0.113.9' } })),
    ).toBe(true);
    expect(isLocalSsrRequest(ssr({ method: 'POST', peer: '::1' }))).toBe(true);
    expect(isLocalSsrRequest(ssr({ peer: '203.0.113.9' }))).toBe(false);
    expect(isLocalSsrRequest(ssr({ headers: {} }))).toBe(false);
    expect(isLocalSsrRequest(ssr({ headers: { 'x-house-ssr': '0' } }))).toBe(false);
  });

  it('recognizes loopback addresses only', () => {
    for (const a of ['127.0.0.1', '127.1.2.3', '::1', '::ffff:127.0.0.1']) {
      expect(isLoopbackAddress(a)).toBe(true);
    }
    for (const a of [undefined, '', '10.0.0.1', '1127.0.0.1', '::2', '::ffff:192.168.0.1']) {
      expect(isLoopbackAddress(a)).toBe(false);
    }
  });
});
