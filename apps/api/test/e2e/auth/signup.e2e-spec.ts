import { randomUUID } from 'node:crypto';
import { COOKIE_NAMES, ErrorCode, TermsType } from '@house/shared';
import { WithdrawnIdentityService } from '../../../src/modules/auth/users/withdrawn-identity.service';
import { resetAll, type TestApp } from '../../utils';
import type { FakeOAuthHttp } from './fakes/fake-oauth-http';
import {
  callback,
  createAuthTestApp,
  createTerms,
  seedTerms,
  setCookies,
  startOAuth,
  WEB_ORIGIN,
} from './helpers';

describe('auth: social signup completion (e2e)', () => {
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

  /** Runs a first Kakao login and returns the pending-signup cookie. */
  async function pendingKakaoSignup(id = 1001, phone = '010-2222-3333'): Promise<string> {
    const s = await startOAuth(t, 'kakao', { query: { returnTo: '/map' } });
    fake.kakaoCode(`code-${id}`, { id, nickname: '초기닉', email: 'new@example.com', phone });
    const res = await callback(
      t,
      'kakao',
      { code: `code-${id}`, state: s.state },
      { house_oauth: s.binding },
    );
    const token = setCookies(res).house_signup;
    if (!token) throw new Error('no pending signup cookie');
    return `house_signup=${token}`;
  }

  /** Sends the signup body; the 만 14세 이상 confirmation is added unless the body sets it. */
  const post = (cookie: string | null, body: object) => {
    const req = t.http().post('/api/v1/auth/signup').set('Origin', WEB_ORIGIN);
    return (cookie ? req.set('Cookie', cookie) : req).send({ ageOver14: true, ...body });
  };

  describe('GET /api/v1/auth/signup', () => {
    it('returns the provider prefill and the current terms', async () => {
      const terms = await seedTerms(t.prisma);
      const cookie = await pendingKakaoSignup();
      const res = await t.http().get('/api/v1/auth/signup').set('Cookie', cookie).expect(200);
      expect(res.body.prefill.phone).toBe('01022223333');
      expect((res.body.terms as { type: string }[]).map((d) => d.type)).toEqual([
        TermsType.SERVICE,
        TermsType.PRIVACY,
        TermsType.LOCATION,
        TermsType.MARKETING,
      ]);
      expect(res.body.terms[0]).toMatchObject({ id: terms.service.id, isRequired: true });
    });

    it('401 without a pending signup', async () => {
      const res = await t.http().get('/api/v1/auth/signup').expect(401);
      expect(res.body.code).toBe(ErrorCode.AUTH_SIGNUP_EXPIRED);
      await t
        .http()
        .get('/api/v1/auth/signup')
        .set('Cookie', 'house_signup=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
        .expect(401);
    });
  });

  describe('POST /api/v1/auth/signup', () => {
    it('creates the member, identity and consent records, then logs in', async () => {
      const terms = await seedTerms(t.prisma);
      const cookie = await pendingKakaoSignup();
      const res = await post(cookie, {
        nickname: '순천댁',
        consents: [
          { termsDocumentId: terms.service.id, agreed: true },
          { termsDocumentId: terms.privacy.id, agreed: true },
          { termsDocumentId: terms.location.id, agreed: true },
        ],
        marketingOptIn: true,
      }).expect(201);

      expect(res.body.returnTo).toBe('/map');
      expect(res.body.user).toMatchObject({
        nickname: '순천댁',
        phone: '01022223333',
        email: 'new@example.com',
        role: 'USER',
        marketingOptIn: true,
        pendingRequiredTerms: [],
      });
      const cookies = setCookies(res);
      expect(cookies[COOKIE_NAMES.SESSION]).toBeTruthy();
      expect(cookies[COOKIE_NAMES.CSRF]).toBe(res.body.csrfToken);
      expect(cookies.house_signup).toBe('');

      const user = await t.prisma.user.findFirstOrThrow({
        include: { identities: true, consents: true },
      });
      expect(user.ageConfirmedAt).not.toBeNull();
      expect(user.identities).toHaveLength(1);
      expect(user.identities[0]).toMatchObject({ provider: 'KAKAO', providerUserId: '1001' });
      // 3 required + the derived marketing decision
      expect(user.consents).toHaveLength(4);
      expect(user.consents.find((c) => c.termsDocumentId === terms.marketing.id)?.agreed).toBe(
        true,
      );

      // the pending signup is single use
      const again = await post(cookie, { nickname: '다시', consents: [] }).expect(401);
      expect(again.body.code).toBe(ErrorCode.AUTH_SIGNUP_EXPIRED);
    });

    it('lets the user drop the provider phone (null) and keeps marketing off by default', async () => {
      const terms = await seedTerms(t.prisma);
      const cookie = await pendingKakaoSignup();
      const res = await post(cookie, {
        nickname: '무전화',
        phone: null,
        consents: [terms.service, terms.privacy, terms.location].map((d) => ({
          termsDocumentId: d.id,
          agreed: true,
        })),
      }).expect(201);
      expect(res.body.user.phone).toBeNull();
      expect(res.body.user.marketingOptIn).toBe(false);
    });

    it('400 AUTH_TERMS_REQUIRED when a required document is not agreed', async () => {
      const terms = await seedTerms(t.prisma);
      const cookie = await pendingKakaoSignup();
      const res = await post(cookie, {
        nickname: '약관미동의',
        consents: [{ termsDocumentId: terms.service.id, agreed: true }],
      }).expect(400);
      expect(res.body.code).toBe(ErrorCode.AUTH_TERMS_REQUIRED);
      expect(res.body.details.missing).toEqual([TermsType.PRIVACY, TermsType.LOCATION]);
      expect(await t.prisma.user.count()).toBe(0);
    });

    it('400 AUTH_TERMS_INVALID for a superseded terms version', async () => {
      const terms = await seedTerms(t.prisma);
      const newer = await createTerms(t.prisma, { type: TermsType.SERVICE, version: '2.0' });
      const cookie = await pendingKakaoSignup();
      const res = await post(cookie, {
        nickname: '구버전',
        consents: [terms.service, terms.privacy, terms.location].map((d) => ({
          termsDocumentId: d.id,
          agreed: true,
        })),
      }).expect(400);
      expect(res.body.code).toBe(ErrorCode.AUTH_TERMS_INVALID);
      expect(newer.id).not.toBe(terms.service.id);
    });

    it('400 VALIDATION_FAILED for a bad nickname or phone', async () => {
      const cookie = await pendingKakaoSignup();
      const bad = await post(cookie, { nickname: 'x', consents: [] }).expect(400);
      expect(bad.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      const phone = await post(cookie, {
        nickname: '정상닉',
        phone: '02-123',
        consents: [],
      }).expect(400);
      expect(phone.body.details[0].path).toBe('phone');
    });

    it('400 without the 만 14세 이상 confirmation (missing or false)', async () => {
      const terms = await seedTerms(t.prisma);
      const cookie = await pendingKakaoSignup();
      const consents = [terms.service, terms.privacy, terms.location].map((d) => ({
        termsDocumentId: d.id,
        agreed: true,
      }));
      for (const ageOver14 of [undefined, false]) {
        const res = await post(cookie, { nickname: '어린이', consents, ageOver14 }).expect(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
        expect(res.body.details[0].path).toBe('ageOver14');
      }
      expect(await t.prisma.user.count()).toBe(0);
    });

    it('403 AUTH_REJOIN_COOLDOWN when the social account withdrew while the signup was pending', async () => {
      const terms = await seedTerms(t.prisma);
      const cookie = await pendingKakaoSignup(77);
      await t.prisma.$transaction((tx) =>
        t.app
          .get(WithdrawnIdentityService)
          .record(tx, randomUUID(), [{ provider: 'KAKAO', providerUserId: '77' }], new Date()),
      );
      const res = await post(cookie, {
        nickname: '재가입',
        consents: [terms.service, terms.privacy, terms.location].map((d) => ({
          termsDocumentId: d.id,
          agreed: true,
        })),
      }).expect(403);
      expect(res.body.code).toBe(ErrorCode.AUTH_REJOIN_COOLDOWN);
      expect(await t.prisma.user.count()).toBe(0);
    });

    it('401 without a pending signup; 403 from a foreign origin', async () => {
      const res = await post(null, { nickname: '아무개', consents: [] }).expect(401);
      expect(res.body.code).toBe(ErrorCode.AUTH_SIGNUP_EXPIRED);
      const cookie = await pendingKakaoSignup();
      const csrf = await t
        .http()
        .post('/api/v1/auth/signup')
        .set('Origin', 'https://evil.example')
        .set('Cookie', cookie)
        .send({ nickname: '아무개', consents: [] })
        .expect(403);
      expect(csrf.body.code).toBe(ErrorCode.CSRF_FAILED);
    });

    it('409 when the same social account finished signup in another tab', async () => {
      await seedTerms(t.prisma);
      const first = await pendingKakaoSignup(55);
      const second = await pendingKakaoSignup(55);
      const current = await t.prisma.termsDocument.findMany({ where: { isRequired: true } });
      const body = {
        nickname: '중복가입',
        consents: current.map((d) => ({ termsDocumentId: d.id, agreed: true })),
      };
      await post(first, body).expect(201);
      const res = await post(second, body).expect(409);
      expect(res.body.code).toBe(ErrorCode.AUTH_IDENTITY_DUPLICATE);
    });
  });
});
