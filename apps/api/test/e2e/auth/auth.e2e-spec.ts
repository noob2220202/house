import { COOKIE_NAMES, ErrorCode, type SessionSummary, UserRole, UserStatus } from '@house/shared';
import {
  createAgency,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import { createAuthTestApp, seedTerms, setCookies, WEB_ORIGIN } from './helpers';

describe('auth: sessions, csrf, /auth/me (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    ({ t } = await createAuthTestApp());
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  it('runs against its own database and Redis index', async () => {
    expect(process.env.DATABASE_URL).toContain('/house_test_auth?');
    expect(t.redis.options.db).toBe(1);
  });

  describe('GET /api/v1/auth/providers', () => {
    it('lists exactly 카카오 / 네이버 / Google', async () => {
      const res = await t.http().get('/api/v1/auth/providers').expect(200);
      expect((res.body as { slug: string }[]).map((p) => p.slug)).toEqual([
        'kakao',
        'naver',
        'google',
      ]);
    });
  });

  describe('GET /api/v1/auth/csrf', () => {
    it('returns the session-bound token when logged in', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const res = await t.http().get('/api/v1/auth/csrf').set('Cookie', s.cookie).expect(200);
      expect(res.body.csrfToken).toBe(s.csrfToken);
      expect(setCookies(res)[COOKIE_NAMES.CSRF]).toBe(s.csrfToken);
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('issues a throwaway token anonymously, in the body only (no cookie)', async () => {
      const res = await t.http().get('/api/v1/auth/csrf').expect(200);
      expect(res.body.csrfToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(setCookies(res)[COOKIE_NAMES.CSRF]).toBeUndefined();
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('a stale or unknown session cookie is anonymous: no csrf cookie either', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      await withSession(t.http().post('/api/v1/auth/logout'), s).expect(204);
      const res = await t.http().get('/api/v1/auth/csrf').set('Cookie', s.cookie).expect(200);
      expect(res.body.csrfToken).not.toBe(s.csrfToken);
      expect(setCookies(res)[COOKIE_NAMES.CSRF]).toBeUndefined();
    });

    it('a state-changing request with a session but a wrong token is rejected (403)', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const res = await t
        .http()
        .post('/api/v1/auth/logout')
        .set('Cookie', s.cookie)
        .set('Origin', WEB_ORIGIN)
        .set('x-csrf-token', 'wrong')
        .expect(403);
      expect(res.body.code).toBe(ErrorCode.CSRF_FAILED);
    });

    it('rejects a malformed session cookie as anonymous (validation of the token shape)', async () => {
      const res = await t
        .http()
        .get('/api/v1/auth/me')
        .set('Cookie', `${COOKIE_NAMES.SESSION}=not-a-token`)
        .expect(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHENTICATED);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns profile, identities, agency membership and pending terms', async () => {
      const terms = await seedTerms(t.prisma);
      const { agency, owner } = await createAgency(t.prisma);
      await t.prisma.identity.create({
        data: { userId: owner.id, provider: 'KAKAO', providerUserId: 'k', email: 'o@example.com' },
      });
      await t.prisma.userConsent.create({
        data: { userId: owner.id, termsDocumentId: terms.service.id, agreed: true },
      });
      const s = await loginUser(
        t.app,
        { id: owner.id, role: UserRole.AGENCY_OWNER },
        { agencyId: agency.id },
      );
      const res = await withSession(t.http().get('/api/v1/auth/me'), s).expect(200);
      expect(res.body).toMatchObject({
        id: owner.id,
        role: UserRole.AGENCY_OWNER,
        status: UserStatus.ACTIVE,
        agency: { agencyId: agency.id, agencyName: agency.name, memberRole: 'OWNER' },
        pendingRequiredTerms: ['PRIVACY', 'LOCATION'],
      });
      expect(res.body.identities).toEqual([
        expect.objectContaining({ provider: 'KAKAO', email: 'o@example.com' }),
      ]);
      expect(res.body).not.toHaveProperty('piiScrubAfter');
    });

    it('writes role / agency changes back into the session', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      // session created before the agency was approved: plain USER, no agency
      const s = await loginUser(t.app, { id: owner.id, role: UserRole.USER });
      await withSession(t.http().get('/api/v1/auth/me'), s).expect(200);
      const raw = await t.redis.get(`session:${s.sessionId}`);
      const record = JSON.parse(raw ?? '{}') as { role: string; agencyId: string };
      expect(record).toMatchObject({ role: UserRole.AGENCY_OWNER, agencyId: agency.id });
    });

    it('401 without a session', async () => {
      const res = await t.http().get('/api/v1/auth/me').expect(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it('401 and session revoked when the account was suspended meanwhile', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      await t.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.SUSPENDED },
      });
      const res = await withSession(t.http().get('/api/v1/auth/me'), s).expect(401);
      expect(res.body.code).toBe(ErrorCode.AUTH_ACCOUNT_SUSPENDED);
      expect(await t.redis.get(`session:${s.sessionId}`)).toBeNull();
    });

    it('an admin cookie is not a user session', async () => {
      const res = await t
        .http()
        .get('/api/v1/auth/me')
        .set('Cookie', `${COOKIE_NAMES.ADMIN_SESSION}=x`)
        .expect(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHENTICATED);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('destroys the current session and clears cookies', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const res = await withSession(t.http().post('/api/v1/auth/logout'), s).expect(204);
      expect(setCookies(res)[COOKIE_NAMES.SESSION]).toBe('');
      await withSession(t.http().get('/api/v1/auth/me'), s).expect(401);
    });

    it('401 without a session', async () => {
      await t.http().post('/api/v1/auth/logout').set('Origin', WEB_ORIGIN).expect(401);
    });

    it('403 without the CSRF header', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      await t
        .http()
        .post('/api/v1/auth/logout')
        .set('Cookie', s.cookie)
        .set('Origin', WEB_ORIGIN)
        .expect(403);
    });
  });

  describe('POST /api/v1/auth/logout-all', () => {
    it('revokes every session of the user only', async () => {
      const user = await createUser(t.prisma);
      const other = await createUser(t.prisma);
      const a = await loginUser(t.app, user);
      const b = await loginUser(t.app, user);
      const o = await loginUser(t.app, other);
      const res = await withSession(t.http().post('/api/v1/auth/logout-all'), a).expect(200);
      expect(res.body.revoked).toBe(2);
      await withSession(t.http().get('/api/v1/auth/me'), b).expect(401);
      await withSession(t.http().get('/api/v1/auth/me'), o).expect(200);
    });

    it('401 without a session', async () => {
      await t.http().post('/api/v1/auth/logout-all').set('Origin', WEB_ORIGIN).expect(401);
    });

    it('403 from a foreign origin', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const res = await withSession(t.http().post('/api/v1/auth/logout-all'), s)
        .set('Origin', 'https://evil.example')
        .expect(403);
      expect(res.body.code).toBe(ErrorCode.CSRF_FAILED);
    });
  });

  describe('GET/DELETE /api/v1/auth/sessions', () => {
    it('lists own devices (current flagged) and revokes one', async () => {
      const user = await createUser(t.prisma);
      const a = await loginUser(t.app, user);
      const b = await loginUser(t.app, user);
      const list = await withSession(t.http().get('/api/v1/auth/sessions'), a).expect(200);
      expect(list.body).toHaveLength(2);
      expect((list.body as SessionSummary[]).find((x) => x.current)?.id).toBe(a.sessionId);
      expect(JSON.stringify(list.body)).not.toContain(a.cookie.split('=')[1]);

      await withSession(t.http().delete(`/api/v1/auth/sessions/${b.sessionId}`), a).expect(204);
      await withSession(t.http().get('/api/v1/auth/me'), b).expect(401);
      await withSession(t.http().get('/api/v1/auth/me'), a).expect(200);
    });

    it("404 for another user's session id (no IDOR)", async () => {
      const user = await createUser(t.prisma);
      const other = await createUser(t.prisma);
      const a = await loginUser(t.app, user);
      const o = await loginUser(t.app, other);
      const res = await withSession(
        t.http().delete(`/api/v1/auth/sessions/${o.sessionId}`),
        a,
      ).expect(404);
      expect(res.body.code).toBe(ErrorCode.AUTH_SESSION_NOT_FOUND);
      await withSession(t.http().get('/api/v1/auth/me'), o).expect(200);
    });

    it('401 without a session', async () => {
      await t.http().get('/api/v1/auth/sessions').expect(401);
      await t
        .http()
        .delete(`/api/v1/auth/sessions/${'a'.repeat(64)}`)
        .set('Origin', WEB_ORIGIN)
        .expect(401);
    });

    it('400 for a malformed session id', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const res = await withSession(t.http().delete('/api/v1/auth/sessions/xyz'), s).expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('session expiry', () => {
    it('drops a session past its absolute max age even if the idle TTL is alive', async () => {
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const key = `session:${s.sessionId}`;
      const record = JSON.parse((await t.redis.get(key)) ?? '{}') as Record<string, unknown>;
      await t.redis.set(
        key,
        JSON.stringify({ ...record, absoluteExpiresAt: Date.now() - 1 }),
        'EX',
        600,
      );
      await withSession(t.http().get('/api/v1/auth/me'), s).expect(401);
      expect(await t.redis.get(key)).toBeNull();
    });
  });
});
