// @vitest-environment node
import { COOKIE_NAMES } from '@house/shared';
import { NextRequest, type NextResponse } from 'next/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  adminAccountSchema,
  adminLoginResultSchema,
  adminSessionResultSchema,
  totpActivateResultSchema,
  totpSetupSchema,
} from './schemas';

/**
 * The mock admin auth routes follow the real controller (apps/api/src/modules/auth/admin): login →
 * pre-MFA session + csrfToken; enrolment = setup → activate (recovery codes once); verify only for
 * enrolled admins (code or recovery code); rotation needs re-auth; CSRF only with a session. The
 * responses must parse with the schemas the login screen uses.
 */
type Routes = {
  login: typeof import('@/app/mock-api/v1/admin/auth/login/route');
  csrf: typeof import('@/app/mock-api/v1/admin/auth/csrf/route');
  setup: typeof import('@/app/mock-api/v1/admin/auth/totp/setup/route');
  activate: typeof import('@/app/mock-api/v1/admin/auth/totp/activate/route');
  verify: typeof import('@/app/mock-api/v1/admin/auth/totp/verify/route');
  me: typeof import('@/app/mock-api/v1/admin/auth/me/route');
  password: typeof import('@/app/mock-api/v1/admin/auth/password/route');
};
let r: Routes;
let MOCK_PASSWORD: string;

beforeAll(async () => {
  // MOCK_ENABLED is read when '@/lib/mock' is first imported.
  vi.stubEnv('NEXT_PUBLIC_API_MOCK', '1');
  vi.resetModules();
  r = {
    login: await import('@/app/mock-api/v1/admin/auth/login/route'),
    csrf: await import('@/app/mock-api/v1/admin/auth/csrf/route'),
    setup: await import('@/app/mock-api/v1/admin/auth/totp/setup/route'),
    activate: await import('@/app/mock-api/v1/admin/auth/totp/activate/route'),
    verify: await import('@/app/mock-api/v1/admin/auth/totp/verify/route'),
    me: await import('@/app/mock-api/v1/admin/auth/me/route'),
    password: await import('@/app/mock-api/v1/admin/auth/password/route'),
  };
  ({ MOCK_PASSWORD } = await import('@/app/mock-api/v1/admin/auth/_mcore'));
});

/** A tiny cookie jar: every response's Set-Cookie applies to the next request. */
class Browser {
  jar = new Map<string, string>();
  csrf: string | null = null;
  absorb(res: NextResponse) {
    for (const c of res.cookies.getAll()) {
      if (c.value === '' || c.maxAge === 0) this.jar.delete(c.name);
      else this.jar.set(c.name, c.value);
    }
    return res;
  }
  req(path: string, body?: unknown, method = 'POST') {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.jar.size)
      headers.cookie = [...this.jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
    if (this.csrf) headers['x-csrf-token'] = this.csrf;
    return new NextRequest(`http://localhost:3201/api/v1/admin/auth/${path}?_delay=1`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }
}

const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

describe('mock admin auth (real contract)', () => {
  it('first login: login → setup (empty body) → activate → recovery codes once', async () => {
    const b = new Browser();
    // No session yet: the login is not CSRF-checked.
    const login = b.absorb(
      await r.login.POST(b.req('login', { email: 'new@example.com', password: MOCK_PASSWORD })),
    );
    expect(login.status).toBe(200);
    const result = adminLoginResultSchema.parse(await json(login));
    expect(result).toMatchObject({ mfaRequired: true, totpEnrolled: false });
    expect(result.csrfToken).toBe(b.jar.get(COOKIE_NAMES.CSRF));

    // The session is pre-MFA: /me answers AUTH_TOTP_REQUIRED, and mutations need its token.
    expect(await json(r.me.GET(b.req('me', undefined, 'GET')))).toMatchObject({
      code: 'AUTH_TOTP_REQUIRED',
    });
    expect((await r.setup.POST(b.req('totp/setup'))).status).toBe(403);
    b.csrf = result.csrfToken!;

    // verify is only for enrolled admins
    const early = await r.verify.POST(b.req('totp/verify', { code: '123456' }));
    expect(early.status).toBe(400);
    expect(await json(early)).toMatchObject({ code: 'AUTH_TOTP_NOT_ENROLLED' });

    // activate without a pending setup
    const expired = await r.activate.POST(b.req('totp/activate', { code: '123456' }));
    expect(await json(expired)).toMatchObject({ code: 'AUTH_TOTP_SETUP_EXPIRED' });

    const setup = b.absorb(await r.setup.POST(b.req('totp/setup')));
    expect(totpSetupSchema.parse(await json(setup)).expiresInSeconds).toBe(600);

    const wrong = await r.activate.POST(b.req('totp/activate', { code: '000000' }));
    expect(wrong.status).toBe(401);
    expect(await json(wrong)).toMatchObject({ code: 'AUTH_TOTP_INVALID' });

    const activated = b.absorb(await r.activate.POST(b.req('totp/activate', { code: '123456' })));
    const done = totpActivateResultSchema.parse(await json(activated));
    expect(done.recoveryCodes).toHaveLength(10);
    // The session was rotated: a new token, and /me works.
    expect(done.csrfToken).not.toBe(result.csrfToken);
    expect(done.csrfToken).toBe(b.jar.get(COOKIE_NAMES.CSRF));
    const me = r.me.GET(b.req('me', undefined, 'GET'));
    expect(me.status).toBe(200);
    expect(adminAccountSchema.parse(await json(me)).totpEnabled).toBe(true);
  });

  it('enrolled login: verify with a code or a recovery code; a wrong login is a plain 401', async () => {
    const bad = await r.login.POST(
      new Browser().req('login', { email: 'admin@example.com', password: 'nope' }),
    );
    expect(bad.status).toBe(401);
    const locked = await r.login.POST(
      new Browser().req('login', { email: 'locked@example.com', password: MOCK_PASSWORD }),
    );
    expect(locked.status).toBe(401);

    for (const factor of [{ code: '123456' }, { recoveryCode: 'h4tn-8wxp' }]) {
      const b = new Browser();
      const login = b.absorb(
        await r.login.POST(b.req('login', { email: 'admin@example.com', password: MOCK_PASSWORD })),
      );
      const result = adminLoginResultSchema.parse(await json(login));
      expect(result.totpEnrolled).toBe(true);
      b.csrf = result.csrfToken!;
      // An enrolled admin cannot start a new enrolment before the second factor.
      expect(await json(await r.setup.POST(b.req('totp/setup')))).toMatchObject({
        code: 'AUTH_TOTP_REQUIRED',
      });
      const verified = b.absorb(await r.verify.POST(b.req('totp/verify', factor)));
      expect(verified.status).toBe(200);
      const session = adminSessionResultSchema.parse(await json(verified));
      expect(session.admin.role).toBe('ADMIN');
      expect(session.csrfToken).toBe(b.jar.get(COOKIE_NAMES.CSRF));
    }
  });

  it('GET /admin/auth/csrf needs an admin session and returns its token', async () => {
    const b = new Browser();
    expect(r.csrf.GET(b.req('csrf', undefined, 'GET')).status).toBe(401);
    b.jar.set(COOKIE_NAMES.ADMIN_SESSION, 'mock-SUPER_ADMIN');
    b.jar.set(COOKIE_NAMES.CSRF, 'tok');
    expect(await json(r.csrf.GET(b.req('csrf', undefined, 'GET')))).toEqual({ csrfToken: 'tok' });
  });

  it('re-enrolment from a verified session requires the password and a current factor', async () => {
    const b = new Browser();
    b.jar.set(COOKIE_NAMES.ADMIN_SESSION, 'mock-SUPER_ADMIN');
    b.jar.set(COOKIE_NAMES.CSRF, 'tok');
    b.csrf = 'tok';
    expect(await json(await r.setup.POST(b.req('totp/setup')))).toMatchObject({
      code: 'AUTH_REAUTH_REQUIRED',
    });
    const wrongPw = await r.setup.POST(
      b.req('totp/setup', { currentPassword: 'nope', code: '123456' }),
    );
    expect(await json(wrongPw)).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    const wrongCode = await r.setup.POST(
      b.req('totp/setup', { currentPassword: MOCK_PASSWORD, code: '000000' }),
    );
    expect(await json(wrongCode)).toMatchObject({ code: 'AUTH_TOTP_INVALID' });
    const ok = b.absorb(
      await r.setup.POST(b.req('totp/setup', { currentPassword: MOCK_PASSWORD, code: '123456' })),
    );
    expect(ok.status).toBe(200);
    const activated = b.absorb(await r.activate.POST(b.req('totp/activate', { code: '123456' })));
    expect(totpActivateResultSchema.parse(await json(activated)).recoveryCodes).toHaveLength(10);
  });

  it('password change follows adminPasswordChangeSchema and rotates the token', async () => {
    const b = new Browser();
    b.jar.set(COOKIE_NAMES.ADMIN_SESSION, 'mock-ADMIN');
    b.jar.set(COOKIE_NAMES.CSRF, 'tok');
    b.csrf = 'tok';
    const short = await r.password.POST(
      b.req('password', { currentPassword: MOCK_PASSWORD, newPassword: 'short2026a' }),
    );
    expect(short.status).toBe(400);
    const wrong = await r.password.POST(
      b.req('password', { currentPassword: 'nope', newPassword: 'suncheon2026admin' }),
    );
    expect(wrong.status).toBe(401);
    const ok = b.absorb(
      await r.password.POST(
        b.req('password', { currentPassword: MOCK_PASSWORD, newPassword: 'suncheon2026admin' }),
      ),
    );
    const session = adminSessionResultSchema.parse(await json(ok));
    expect(session.csrfToken).not.toBe('tok');
  });
});
