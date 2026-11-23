import { AuthProvider, COOKIE_NAMES, ErrorCode, UserStatus } from '@house/shared';
import { createUser, loginUser, resetAll, type TestApp } from '../../utils';
import type { FakeOAuthHttp } from './fakes/fake-oauth-http';
import {
  callback,
  createAuthTestApp,
  rawSetCookie,
  redirectTarget,
  setCookies,
  startOAuth,
} from './helpers';

describe('auth: social OAuth (e2e)', () => {
  let t: TestApp;
  let fake: FakeOAuthHttp;

  beforeAll(async () => {
    ({ t, fake } = await createAuthTestApp());
  });
  beforeEach(async () => {
    fake.reset();
    await resetAll(t);
  });
  afterAll(() => t?.close());

  describe('GET /api/v1/auth/oauth/:provider/start', () => {
    it('redirects to Kakao with state and binds it to the browser', async () => {
      const { res, location, state, binding } = await startOAuth(t, 'kakao', {
        query: { returnTo: '/listings?dealType=SALE' },
      });
      expect(location.origin + location.pathname).toBe('https://kauth.kakao.com/oauth/authorize');
      expect(location.searchParams.get('client_id')).toBe('test-kakao-client');
      expect(location.searchParams.get('redirect_uri')).toBe(
        'http://localhost:4000/api/v1/auth/oauth/kakao/callback',
      );
      expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(binding).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const cookie = rawSetCookie(res, 'house_oauth') ?? '';
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Path=/api/v1/auth/oauth');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('sends PKCE S256 + nonce + openid scope to Google', async () => {
      const { location } = await startOAuth(t, 'google');
      expect(location.host).toBe('accounts.google.com');
      expect(location.searchParams.get('code_challenge_method')).toBe('S256');
      expect(location.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(location.searchParams.get('nonce')).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(location.searchParams.get('scope')).toBe('openid email profile');
    });

    it('redirects to Naver', async () => {
      const { location } = await startOAuth(t, 'naver');
      expect(location.host).toBe('nid.naver.com');
      expect(location.searchParams.get('response_type')).toBe('code');
    });

    it('reuses the binding cookie so two tabs can log in in parallel', async () => {
      const first = await startOAuth(t, 'kakao');
      const second = await startOAuth(t, 'naver', { cookie: `house_oauth=${first.binding}` });
      expect(second.binding).toBe(first.binding);
    });

    it('400 for unsupported providers (Apple is not offered)', async () => {
      const res = await t.http().get('/api/v1/auth/oauth/apple/start').expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      await t.http().get('/api/v1/auth/oauth/KAKAO/start').expect(400);
    });

    it('400 for an open-redirect returnTo', async () => {
      for (const returnTo of ['//evil.example', 'https://evil.example', '/\\evil.example']) {
        const res = await t.http().get('/api/v1/auth/oauth/kakao/start').query({ returnTo });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      }
    });

    it('401 when intent=link is requested without a session', async () => {
      const res = await t
        .http()
        .get('/api/v1/auth/oauth/kakao/start')
        .query({ intent: 'link' })
        .expect(401);
      expect(res.body.code).toBe(ErrorCode.UNAUTHENTICATED);
    });
  });

  describe('GET /api/v1/auth/oauth/:provider/callback', () => {
    it('first login parks a pending signup and redirects to the signup page', async () => {
      const { state, binding } = await startOAuth(t, 'kakao', { query: { returnTo: '/map' } });
      fake.kakaoCode('code-1', {
        id: 4242,
        nickname: '순천사람',
        email: 'Kim@Example.com',
        phone: '+82 10-1234-5678',
      });
      const res = await callback(
        t,
        'kakao',
        { code: 'code-1', state },
        { house_oauth: binding },
      ).expect(302);
      const target = redirectTarget(res);
      expect(target.origin).toBe('http://localhost:3000');
      expect(target.pathname).toBe('/signup');
      expect(target.searchParams.get('provider')).toBe('kakao');
      const cookies = setCookies(res);
      expect(cookies.house_signup).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(cookies[COOKIE_NAMES.SESSION]).toBeUndefined();
      expect(await t.prisma.user.count()).toBe(0);

      const pending = await t
        .http()
        .get('/api/v1/auth/signup')
        .set('Cookie', `house_signup=${cookies.house_signup}`)
        .expect(200);
      expect(pending.body).toMatchObject({
        provider: AuthProvider.KAKAO,
        prefill: { nickname: '순천사람', email: 'kim@example.com', phone: '01012345678' },
      });
      expect(pending.body.prefill.profileImageUrl).toMatch(/^https:\/\//);
    });

    it('existing identity logs in, rotates any old session and returns to returnTo', async () => {
      const user = await createUser(t.prisma, {
        identities: { create: { provider: 'KAKAO', providerUserId: '777' } },
      });
      const old = await loginUser(t.app, user);
      const { state, binding } = await startOAuth(t, 'kakao', {
        query: { returnTo: '/complexes/1?tab=trades' },
      });
      fake.kakaoCode('c', { id: 777, nickname: 'n' });
      const res = await callback(
        t,
        'kakao',
        { code: 'c', state },
        { house_oauth: binding, [COOKIE_NAMES.SESSION]: old.cookie.split('=')[1] },
      ).expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/complexes/1?tab=trades');
      const cookies = setCookies(res);
      const sid = cookies[COOKIE_NAMES.SESSION];
      expect(sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(rawSetCookie(res, COOKIE_NAMES.SESSION)).toContain('HttpOnly');
      expect(cookies[COOKIE_NAMES.CSRF]).toBeTruthy();

      await t.http().get('/api/v1/auth/me').set('Cookie', old.cookie).expect(401);
      const me = await t
        .http()
        .get('/api/v1/auth/me')
        .set('Cookie', `${COOKIE_NAMES.SESSION}=${sid}`)
        .expect(200);
      expect(me.body.id).toBe(user.id);
      const identity = await t.prisma.identity.findFirstOrThrow({ where: { userId: user.id } });
      expect(identity.lastUsedAt).not.toBeNull();
      expect(
        (await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).lastLoginAt,
      ).not.toBeNull();
    });

    it('Naver login works end to end (HTTP-200 token errors are failures)', async () => {
      await createUser(t.prisma, {
        identities: { create: { provider: 'NAVER', providerUserId: 'nv-1' } },
      });
      const ok = await startOAuth(t, 'naver');
      fake.naverCode('nc', { id: 'nv-1', mobile: '010-9876-5432' });
      const res = await callback(
        t,
        'naver',
        { code: 'nc', state: ok.state },
        { house_oauth: ok.binding },
      ).expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/');

      const bad = await startOAuth(t, 'naver');
      const res2 = await callback(
        t,
        'naver',
        { code: 'unknown', state: bad.state },
        { house_oauth: bad.binding },
      ).expect(302);
      expect(redirectTarget(res2).searchParams.get('error')).toBe(
        ErrorCode.AUTH_OAUTH_PROVIDER_ERROR,
      );
    });

    it('Google: verified id_token logs in; wrong nonce / foreign key / wrong audience are rejected', async () => {
      await createUser(t.prisma, {
        identities: { create: { provider: 'GOOGLE', providerUserId: 'g-sub-1' } },
      });
      const ok = await startOAuth(t, 'google');
      fake.googleCode('gc', { sub: 'g-sub-1', nonce: ok.nonce, email: 'a@gmail.com' });
      const res = await callback(
        t,
        'google',
        { code: 'gc', state: ok.state },
        { house_oauth: ok.binding },
      ).expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/');
      const tokenReq = fake.requests.find((r) => r.url === 'https://oauth2.googleapis.com/token');
      expect(tokenReq?.form?.code_verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);

      for (const bad of [
        { nonce: 'not-the-nonce' },
        { foreignKey: true },
        { aud: 'someone-else.apps.googleusercontent.com' },
        { iss: 'https://evil.example' },
        { expOffsetSeconds: -3600 },
      ]) {
        const s = await startOAuth(t, 'google');
        fake.googleCode('gbad', { sub: 'g-sub-1', nonce: s.nonce, ...bad });
        const r = await callback(
          t,
          'google',
          { code: 'gbad', state: s.state },
          { house_oauth: s.binding },
        ).expect(302);
        expect(redirectTarget(r).searchParams.get('error')).toBe(
          ErrorCode.AUTH_OAUTH_PROVIDER_ERROR,
        );
        expect(setCookies(r)[COOKIE_NAMES.SESSION]).toBeUndefined();
      }
    });

    it('rejects a state from another browser (login CSRF), a replayed state and a provider mismatch', async () => {
      await createUser(t.prisma, {
        identities: { create: { provider: 'KAKAO', providerUserId: '1' } },
      });
      fake.kakaoCode('c', { id: 1 });
      const attacker = await startOAuth(t, 'kakao');
      const victim = await callback(t, 'kakao', { code: 'c', state: attacker.state }, {}).expect(
        302,
      );
      expect(redirectTarget(victim).pathname).toBe('/login');
      expect(redirectTarget(victim).searchParams.get('error')).toBe(
        ErrorCode.AUTH_OAUTH_STATE_INVALID,
      );

      const s = await startOAuth(t, 'kakao');
      await callback(t, 'kakao', { code: 'c', state: s.state }, { house_oauth: s.binding }).expect(
        302,
      );
      const replay = await callback(
        t,
        'kakao',
        { code: 'c', state: s.state },
        { house_oauth: s.binding },
      ).expect(302);
      expect(redirectTarget(replay).searchParams.get('error')).toBe(
        ErrorCode.AUTH_OAUTH_STATE_INVALID,
      );

      const n = await startOAuth(t, 'naver');
      const mismatch = await callback(
        t,
        'kakao',
        { code: 'c', state: n.state },
        { house_oauth: n.binding },
      ).expect(302);
      expect(redirectTarget(mismatch).searchParams.get('error')).toBe(
        ErrorCode.AUTH_OAUTH_STATE_INVALID,
      );
    });

    it('maps a user cancellation to AUTH_OAUTH_CANCELLED', async () => {
      const s = await startOAuth(t, 'kakao');
      const res = await callback(
        t,
        'kakao',
        { error: 'access_denied', state: s.state },
        { house_oauth: s.binding },
      ).expect(302);
      expect(redirectTarget(res).searchParams.get('error')).toBe(ErrorCode.AUTH_OAUTH_CANCELLED);
      expect(fake.requests).toHaveLength(0);
    });

    it('does not log in suspended members', async () => {
      await createUser(t.prisma, {
        status: UserStatus.SUSPENDED,
        identities: { create: { provider: 'KAKAO', providerUserId: '99' } },
      });
      const s = await startOAuth(t, 'kakao');
      fake.kakaoCode('c', { id: 99 });
      const res = await callback(
        t,
        'kakao',
        { code: 'c', state: s.state },
        { house_oauth: s.binding },
      ).expect(302);
      expect(redirectTarget(res).searchParams.get('error')).toBe(ErrorCode.AUTH_ACCOUNT_SUSPENDED);
      expect(setCookies(res)[COOKIE_NAMES.SESSION]).toBeUndefined();
    });

    it('never links by email: same email from another provider still means a new signup', async () => {
      await createUser(t.prisma, {
        email: 'same@example.com',
        identities: {
          create: {
            provider: 'KAKAO',
            providerUserId: '5',
            email: 'same@example.com',
            emailVerified: true,
          },
        },
      });
      const s = await startOAuth(t, 'google');
      fake.googleCode('g', { sub: 'g-5', nonce: s.nonce, email: 'same@example.com' });
      const res = await callback(
        t,
        'google',
        { code: 'g', state: s.state },
        { house_oauth: s.binding },
      ).expect(302);
      expect(redirectTarget(res).pathname).toBe('/signup');
      expect(await t.prisma.identity.count()).toBe(1);
    });

    it('400 when state is missing', async () => {
      const res = await t
        .http()
        .get('/api/v1/auth/oauth/kakao/callback')
        .query({ code: 'x' })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('identity linking (intent=link)', () => {
    it('links a new provider to the logged-in user', async () => {
      const user = await createUser(t.prisma, {
        identities: { create: { provider: 'KAKAO', providerUserId: 'k1' } },
      });
      const s = await loginUser(t.app, user);
      const started = await startOAuth(t, 'naver', {
        query: { intent: 'link', returnTo: '/my/account' },
        cookie: s.cookie,
      });
      fake.naverCode('n', { id: 'nv-link' });
      const res = await callback(
        t,
        'naver',
        { code: 'n', state: started.state },
        { house_oauth: started.binding, [COOKIE_NAMES.SESSION]: s.cookie.split('=')[1] },
      ).expect(302);
      expect(res.headers.location).toBe('http://localhost:3000/my/account?linked=naver');
      const ids = await t.prisma.identity.findMany({ where: { userId: user.id } });
      expect(ids.map((i) => i.provider).sort()).toEqual(['KAKAO', 'NAVER']);
    });

    it('refuses an identity that belongs to another account', async () => {
      await createUser(t.prisma, {
        identities: { create: { provider: 'NAVER', providerUserId: 'taken' } },
      });
      const me = await createUser(t.prisma, {
        identities: { create: { provider: 'KAKAO', providerUserId: 'mine' } },
      });
      const s = await loginUser(t.app, me);
      const started = await startOAuth(t, 'naver', { query: { intent: 'link' }, cookie: s.cookie });
      fake.naverCode('n', { id: 'taken' });
      const res = await callback(
        t,
        'naver',
        { code: 'n', state: started.state },
        { house_oauth: started.binding, [COOKIE_NAMES.SESSION]: s.cookie.split('=')[1] },
      ).expect(302);
      const target = redirectTarget(res);
      expect(target.pathname).toBe('/my/account');
      expect(target.searchParams.get('error')).toBe(ErrorCode.AUTH_IDENTITY_DUPLICATE);
    });

    it('refuses to finish a link in a browser logged in as someone else', async () => {
      const a = await createUser(t.prisma);
      const b = await createUser(t.prisma);
      const sa = await loginUser(t.app, a);
      const sb = await loginUser(t.app, b);
      const started = await startOAuth(t, 'naver', {
        query: { intent: 'link' },
        cookie: sa.cookie,
      });
      fake.naverCode('n', { id: 'x' });
      const res = await callback(
        t,
        'naver',
        { code: 'n', state: started.state },
        { house_oauth: started.binding, [COOKIE_NAMES.SESSION]: sb.cookie.split('=')[1] },
      ).expect(302);
      expect(redirectTarget(res).searchParams.get('error')).toBe(
        ErrorCode.AUTH_OAUTH_STATE_INVALID,
      );
      expect(await t.prisma.identity.count()).toBe(0);
    });
  });
});
