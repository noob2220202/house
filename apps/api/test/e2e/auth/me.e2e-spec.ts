import { randomUUID } from 'node:crypto';
import { COOKIE_NAMES, ErrorCode, TermsType, UserRole, UserStatus } from '@house/shared';
import { SUSPENDED_PII_RETENTION_DAYS } from '../../../src/modules/auth/auth.constants';
import { PiiScrubService } from '../../../src/modules/auth/jobs/pii-scrub.service';
import {
  createActionConsentTerms,
  createAgency,
  createComplex,
  createListing,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import type { FakeOAuthHttp } from './fakes/fake-oauth-http';
import {
  callback,
  createAuthTestApp,
  rawSetCookie,
  redirectTarget,
  seedTerms,
  setCookies,
  startOAuth,
  WEB_ORIGIN,
} from './helpers';

describe('auth: /me account endpoints (e2e)', () => {
  let t: TestApp;
  let fake: FakeOAuthHttp;

  beforeAll(async () => {
    ({ t, fake } = await createAuthTestApp());
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function member(identities: ('KAKAO' | 'NAVER' | 'GOOGLE')[] = ['KAKAO']) {
    const user = await createUser(t.prisma, {
      phone: '01011112222',
      identities: {
        create: identities.map((provider) => ({
          provider,
          providerUserId: `${provider}-${Math.random()}`,
        })),
      },
    });
    return { user, s: await loginUser(t.app, user) };
  }

  describe('PATCH /api/v1/me/profile', () => {
    it('updates nickname / phone (normalized, unverified) / marketing with a consent record', async () => {
      const terms = await seedTerms(t.prisma);
      const { user, s } = await member();
      const res = await withSession(t.http().patch('/api/v1/me/profile'), s)
        .send({ nickname: '새닉네임', phone: '+82 10-5555-6666', marketingOptIn: true })
        .expect(200);
      expect(res.body).toMatchObject({
        nickname: '새닉네임',
        phone: '01055556666',
        marketingOptIn: true,
      });
      const consent = await t.prisma.userConsent.findFirstOrThrow({ where: { userId: user.id } });
      expect(consent).toMatchObject({ termsDocumentId: terms.marketing.id, agreed: true });

      const cleared = await withSession(t.http().patch('/api/v1/me/profile'), s)
        .send({ phone: null })
        .expect(200);
      expect(cleared.body.phone).toBeNull();
    });

    it('marketingOptInAt: set when opting in, kept while opted in, cleared on opt-out', async () => {
      await seedTerms(t.prisma);
      const { s } = await member();
      const initial = await withSession(t.http().get('/api/v1/auth/me'), s).expect(200);
      expect(initial.body).toMatchObject({ marketingOptIn: false, marketingOptInAt: null });

      const before = Date.now();
      const on = await withSession(t.http().patch('/api/v1/me/profile'), s)
        .send({ marketingOptIn: true })
        .expect(200);
      const at = on.body.marketingOptInAt as string;
      expect(new Date(at).getTime()).toBeGreaterThanOrEqual(before - 1000);

      // Re-saving the same choice (profile or consent screen) keeps the original date.
      const again = await withSession(t.http().patch('/api/v1/me/profile'), s)
        .send({ marketingOptIn: true, nickname: '다시저장' })
        .expect(200);
      expect(again.body.marketingOptInAt).toBe(at);
      const me = await withSession(t.http().get('/api/v1/auth/me'), s).expect(200);
      expect(me.body.marketingOptInAt).toBe(at);

      const off = await withSession(t.http().patch('/api/v1/me/profile'), s)
        .send({ marketingOptIn: false })
        .expect(200);
      expect(off.body).toMatchObject({ marketingOptIn: false, marketingOptInAt: null });
    });

    it('401 without a session', async () => {
      await t
        .http()
        .patch('/api/v1/me/profile')
        .set('Origin', WEB_ORIGIN)
        .send({ nickname: '닉네임' })
        .expect(401);
    });

    it('400 for a landline as mobile phone, a bad nickname or an empty patch', async () => {
      const { s } = await member();
      for (const body of [{ phone: '0612345678' }, { nickname: '<script>' }, {}]) {
        const res = await withSession(t.http().patch('/api/v1/me/profile'), s)
          .send(body)
          .expect(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      }
    });
  });

  describe('GET/DELETE /api/v1/me/identities', () => {
    it('lists and unlinks providers', async () => {
      const { s } = await member(['KAKAO', 'GOOGLE']);
      const list = await withSession(t.http().get('/api/v1/me/identities'), s).expect(200);
      expect((list.body as { provider: string }[]).map((i) => i.provider)).toEqual([
        'KAKAO',
        'GOOGLE',
      ]);
      const res = await withSession(t.http().delete('/api/v1/me/identities/google'), s).expect(200);
      expect((res.body as { provider: string }[]).map((i) => i.provider)).toEqual(['KAKAO']);
    });

    it('409 for the last login method; 404 for a provider not linked', async () => {
      const { s } = await member(['KAKAO']);
      const last = await withSession(t.http().delete('/api/v1/me/identities/kakao'), s).expect(409);
      expect(last.body.code).toBe(ErrorCode.AUTH_LAST_IDENTITY);
      const missing = await withSession(t.http().delete('/api/v1/me/identities/naver'), s).expect(
        404,
      );
      expect(missing.body.code).toBe(ErrorCode.AUTH_IDENTITY_NOT_FOUND);
    });

    it("cannot touch another member's identities", async () => {
      const victim = await member(['KAKAO', 'NAVER']);
      const { s } = await member(['KAKAO', 'GOOGLE']);
      await withSession(t.http().delete('/api/v1/me/identities/naver'), s).expect(404);
      expect(await t.prisma.identity.count({ where: { userId: victim.user.id } })).toBe(2);
    });

    it('401 without a session; 400 for an unknown provider', async () => {
      await t.http().get('/api/v1/me/identities').expect(401);
      const { s } = await member();
      const res = await withSession(t.http().delete('/api/v1/me/identities/apple'), s).expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('GET/POST /api/v1/me/consents', () => {
    it('shows status per current document and records new decisions', async () => {
      const terms = await seedTerms(t.prisma);
      const { user, s } = await member();
      const before = await withSession(t.http().get('/api/v1/me/consents'), s).expect(200);
      expect(before.body).toHaveLength(4);
      expect((before.body as { agreed: boolean }[]).every((c) => !c.agreed)).toBe(true);

      const res = await withSession(t.http().post('/api/v1/me/consents'), s)
        .send({
          consents: [
            { termsDocumentId: terms.privacy.id, agreed: true },
            { termsDocumentId: terms.marketing.id, agreed: true },
          ],
        })
        .expect(200);
      const byType = Object.fromEntries(
        (res.body as { terms: { type: string }; agreed: boolean }[]).map((c) => [
          c.terms.type,
          c.agreed,
        ]),
      );
      expect(byType).toEqual({ SERVICE: false, PRIVACY: true, LOCATION: false, MARKETING: true });
      expect(
        (await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).marketingOptIn,
      ).toBe(true);

      // marketing can be revoked (append-only history)
      await withSession(t.http().post('/api/v1/me/consents'), s)
        .send({ consents: [{ termsDocumentId: terms.marketing.id, agreed: false }] })
        .expect(200);
      expect(await t.prisma.userConsent.count({ where: { userId: user.id } })).toBe(3);
      expect(
        (await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } })).marketingOptIn,
      ).toBe(false);
    });

    it('purpose consents (D8) are not account terms: not listed, not decidable here', async () => {
      await seedTerms(t.prisma);
      const purpose = await createActionConsentTerms(t.prisma);
      const { s } = await member();
      const status = await withSession(t.http().get('/api/v1/me/consents'), s).expect(200);
      expect((status.body as { terms: { type: string } }[]).map((c) => c.terms.type)).toEqual([
        TermsType.SERVICE,
        TermsType.PRIVACY,
        TermsType.LOCATION,
        TermsType.MARKETING,
      ]);
      const res = await withSession(t.http().post('/api/v1/me/consents'), s)
        .send({
          consents: [
            {
              termsDocumentId: purpose.find((d) => d.type === TermsType.DEAL_REQUEST_PRIVACY)?.id,
              agreed: false,
            },
          ],
        })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.AUTH_TERMS_INVALID);
    });

    it('400 when revoking a required document or using an unknown one', async () => {
      const terms = await seedTerms(t.prisma);
      const { s } = await member();
      const revoke = await withSession(t.http().post('/api/v1/me/consents'), s)
        .send({ consents: [{ termsDocumentId: terms.service.id, agreed: false }] })
        .expect(400);
      expect(revoke.body.code).toBe(ErrorCode.AUTH_REQUIRED_TERMS_REVOKE);
      const unknown = await withSession(t.http().post('/api/v1/me/consents'), s)
        .send({
          consents: [{ termsDocumentId: '01900000-0000-7000-8000-000000000000', agreed: true }],
        })
        .expect(400);
      expect(unknown.body.code).toBe(ErrorCode.AUTH_TERMS_INVALID);
    });

    it('400 for a malformed body', async () => {
      const { s } = await member();
      const res = await withSession(t.http().post('/api/v1/me/consents'), s)
        .send({ consents: [{ termsDocumentId: 'nope', agreed: 'yes' }] })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('401 without a session', async () => {
      await t.http().get('/api/v1/me/consents').expect(401);
      await t
        .http()
        .post('/api/v1/me/consents')
        .set('Origin', WEB_ORIGIN)
        .send({ consents: [] })
        .expect(401);
    });
  });

  describe('POST /api/v1/me/withdraw', () => {
    it('soft-deletes, logs out everywhere, unlinks identities; the scrub job erases PII later', async () => {
      const terms = await seedTerms(t.prisma);
      const { user, s } = await member(['KAKAO', 'NAVER']);
      await t.prisma.userConsent.create({
        data: { userId: user.id, termsDocumentId: terms.service.id, agreed: true, ip: '1.2.3.4' },
      });
      const { agency } = await createAgency(t.prisma);
      const inquiry = await t.prisma.inquiry.create({
        data: {
          agencyId: agency.id,
          userId: user.id,
          channel: 'MESSAGE',
          status: 'NEW',
          source: 'MAIN',
          customerName: '홍길동',
          customerPhone: '01012345678',
          message: '주말에 집 볼 수 있을까요?',
          lastMessageAt: new Date(),
        },
      });
      const other = await loginUser(t.app, user);
      await withSession(t.http().post('/api/v1/me/withdraw'), s)
        .send({ confirm: true, reason: '이사' })
        .expect(204);

      const row = await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.status).toBe(UserStatus.WITHDRAWN);
      expect(row.withdrawalReason).toBe('이사');
      expect(row.piiScrubAfter!.getTime() - row.withdrawnAt!.getTime()).toBe(30 * 86_400_000);
      expect(row.email).not.toBeNull(); // kept during the grace period
      expect(await t.prisma.identity.count({ where: { userId: user.id } })).toBe(0);
      await withSession(t.http().get('/api/v1/auth/me'), other).expect(401);
      // 문의: erased in the withdrawal transaction itself, not after the grace period.
      const scrubbedInquiry = await t.prisma.inquiry.findUniqueOrThrow({
        where: { id: inquiry.id },
      });
      expect(scrubbedInquiry).toMatchObject({
        customerName: null,
        customerPhone: null,
        message: null,
      });
      expect(scrubbedInquiry.piiScrubbedAt).not.toBeNull();

      const scrubber = t.app.get(PiiScrubService);
      expect(await scrubber.scrubDue(new Date())).toBe(0);
      expect(await scrubber.scrubDue(new Date(Date.now() + 31 * 86_400_000))).toBe(1);
      const scrubbed = await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(scrubbed).toMatchObject({
        email: null,
        name: null,
        nickname: null,
        phone: null,
        withdrawalReason: null,
      });
      expect(scrubbed.piiScrubbedAt).not.toBeNull();
      const consent = await t.prisma.userConsent.findFirstOrThrow({ where: { userId: user.id } });
      expect(consent.ip).toBeNull();
      // idempotent
      expect(await scrubber.scrubDue(new Date(Date.now() + 31 * 86_400_000))).toBe(0);
    });

    it('the same social account cannot sign up again during the cooldown (tombstone, HMAC only)', async () => {
      const user = await createUser(t.prisma, {
        identities: { create: { provider: 'KAKAO', providerUserId: '4242' } },
      });
      const s = await loginUser(t.app, user);
      await withSession(t.http().post('/api/v1/me/withdraw'), s)
        .send({ confirm: true })
        .expect(204);

      const tomb = await t.prisma.withdrawnIdentity.findFirstOrThrow();
      expect(tomb).toMatchObject({ provider: 'KAKAO', userId: user.id });
      expect(tomb.providerUserIdHash).toMatch(/^[0-9a-f]{64}$/);
      expect(tomb.providerUserIdHash).not.toContain('4242');
      expect(tomb.rejoinAfter.getTime() - tomb.withdrawnAt.getTime()).toBe(30 * 86_400_000);

      fake.reset();
      const flow = await startOAuth(t, 'kakao');
      fake.kakaoCode('rejoin', { id: 4242, nickname: '재가입' });
      const res = await callback(
        t,
        'kakao',
        { code: 'rejoin', state: flow.state },
        { house_oauth: flow.binding },
      ).expect(302);
      const target = redirectTarget(res);
      expect(target.pathname).toBe('/login');
      expect(target.searchParams.get('error')).toBe(ErrorCode.AUTH_REJOIN_COOLDOWN);

      // a different social account is not affected
      const other = await startOAuth(t, 'kakao');
      fake.kakaoCode('fresh', { id: 5151, nickname: '새사람' });
      const ok = await callback(
        t,
        'kakao',
        { code: 'fresh', state: other.state },
        { house_oauth: other.binding },
      ).expect(302);
      expect(redirectTarget(ok).pathname).toBe('/signup');

      // the scrub job drops tombstones once the cooldown is over
      const scrubber = t.app.get(PiiScrubService);
      await scrubber.scrubDue(new Date(Date.now() + 29 * 86_400_000));
      expect(await t.prisma.withdrawnIdentity.count()).toBe(1);
      await scrubber.scrubDue(new Date(Date.now() + 31 * 86_400_000));
      expect(await t.prisma.withdrawnIdentity.count()).toBe(0);
    });

    it('a suspended member can still withdraw (ticket from the refused login); PII kept 90 days', async () => {
      const user = await createUser(t.prisma, {
        status: UserStatus.SUSPENDED,
        suspendedAt: new Date(),
        suspendedReason: '허위매물 반복 등록',
        identities: { create: { provider: 'KAKAO', providerUserId: '7777' } },
      });
      const flow = await startOAuth(t, 'kakao');
      fake.kakaoCode('c-susp', { id: 7777 });
      const login = await callback(
        t,
        'kakao',
        { code: 'c-susp', state: flow.state },
        { house_oauth: flow.binding },
      ).expect(302);
      const target = redirectTarget(login);
      expect(target.searchParams.get('error')).toBe(ErrorCode.AUTH_ACCOUNT_SUSPENDED);
      expect(target.searchParams.get('withdrawable')).toBe('1');
      const cookies = setCookies(login);
      expect(cookies[COOKIE_NAMES.SESSION]).toBeUndefined();
      const ticket = cookies.house_withdraw;
      expect(ticket).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const raw = rawSetCookie(login, 'house_withdraw') ?? '';
      expect(raw).toMatch(/HttpOnly/i);
      expect(raw).toContain('Path=/api/v1/auth/withdraw');

      const withTicket = () =>
        t
          .http()
          .post('/api/v1/auth/withdraw')
          .set('Origin', WEB_ORIGIN)
          .set('Cookie', `house_withdraw=${ticket}`);
      // the ticket is not a session
      await t.http().get('/api/v1/auth/me').set('Cookie', `house_withdraw=${ticket}`).expect(401);
      const invalid = await withTicket().send({ reason: 'x' }).expect(400);
      expect(invalid.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      await withTicket().send({ confirm: true, reason: '개인정보 삭제 요청' }).expect(204);

      const row = await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(row.status).toBe(UserStatus.WITHDRAWN);
      expect(row.piiScrubAfter!.getTime() - row.withdrawnAt!.getTime()).toBe(
        SUSPENDED_PII_RETENTION_DAYS * 86_400_000,
      );
      expect(row.suspendedReason).toBe('허위매물 반복 등록'); // moderation evidence kept
      expect(await t.prisma.identity.count({ where: { userId: user.id } })).toBe(0);
      const tombstone = await t.prisma.withdrawnIdentity.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(tombstone.rejoinAfter.getTime() - row.withdrawnAt!.getTime()).toBe(
        SUSPENDED_PII_RETENTION_DAYS * 86_400_000,
      );
      // single use
      await withTicket().send({ confirm: true }).expect(401);

      const scrubber = t.app.get(PiiScrubService);
      expect(await scrubber.scrubDue(new Date(Date.now() + 31 * 86_400_000))).toBe(0);
      expect(await scrubber.scrubDue(new Date(Date.now() + 91 * 86_400_000))).toBe(1);
      const scrubbed = await t.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(scrubbed).toMatchObject({
        suspendedReason: null,
        withdrawalReason: null,
        email: null,
      });
    });

    it('POST /auth/withdraw: 401 without a ticket or with a forged one; 403 from a foreign origin', async () => {
      await t
        .http()
        .post('/api/v1/auth/withdraw')
        .set('Origin', WEB_ORIGIN)
        .send({ confirm: true })
        .expect(401);
      await t
        .http()
        .post('/api/v1/auth/withdraw')
        .set('Origin', WEB_ORIGIN)
        .set('Cookie', `house_withdraw=${'A'.repeat(43)}`)
        .send({ confirm: true })
        .expect(401);
      const csrf = await t
        .http()
        .post('/api/v1/auth/withdraw')
        .set('Origin', 'https://evil.example')
        .send({ confirm: true })
        .expect(403);
      expect(csrf.body.code).toBe(ErrorCode.CSRF_FAILED);
    });

    it('a suspended member who still runs an agency gets 409 and keeps the ticket', async () => {
      const { owner } = await createAgency(t.prisma);
      await t.prisma.user.update({
        where: { id: owner.id },
        data: { status: UserStatus.SUSPENDED },
      });
      await t.prisma.identity.create({
        data: { userId: owner.id, provider: 'KAKAO', providerUserId: '8888' },
      });
      const flow = await startOAuth(t, 'kakao');
      fake.kakaoCode('c-own', { id: 8888 });
      const login = await callback(
        t,
        'kakao',
        { code: 'c-own', state: flow.state },
        { house_oauth: flow.binding },
      ).expect(302);
      const ticket = setCookies(login).house_withdraw;
      const send = () =>
        t
          .http()
          .post('/api/v1/auth/withdraw')
          .set('Origin', WEB_ORIGIN)
          .set('Cookie', `house_withdraw=${ticket}`)
          .send({ confirm: true });
      expect((await send().expect(409)).body.code).toBe(ErrorCode.AUTH_WITHDRAW_AGENCY_OWNER);
      expect((await send().expect(409)).body.code).toBe(ErrorCode.AUTH_WITHDRAW_AGENCY_OWNER);
      const row = await t.prisma.user.findUniqueOrThrow({ where: { id: owner.id } });
      expect(row.status).toBe(UserStatus.SUSPENDED);
    });

    it('cancels live deal requests and erases their contacts at once; the scrub job erases linked data', async () => {
      const { user, s } = await member();
      const { agency } = await createAgency(t.prisma);
      const requestId = randomUUID();
      // raw insert: only the columns this suite relies on
      await t.prisma.$executeRaw`
        INSERT INTO deal_requests (id, type, user_id, status, asset_type, visibility, sgg_code,
                                   contact_name, contact_phone, address_detail, updated_at)
        VALUES (${requestId}::uuid, 'SELL_OR_LEASE', ${user.id}::uuid, 'OPEN', 'APT',
                'ALL_AGENCIES_IN_REGION', '12150', '홍길동', '01012345678', '101동 1001호', now())`;
      await t.prisma.$executeRaw`
        INSERT INTO deal_request_contact_grants (deal_request_id, agency_id)
        VALUES (${requestId}::uuid, ${agency.id}::uuid)`;
      const complex = await createComplex(t.prisma);
      const { listing } = await createListing(t.prisma, { agencyId: agency.id });
      await t.prisma.report.create({
        data: {
          targetType: 'LISTING',
          listingId: listing.id,
          reporterUserId: user.id,
          reporterPhone: '01099998888',
          reason: 'NOT_EXIST',
          ip: '203.0.113.9',
        },
      });
      await t.prisma.notification.create({
        data: { userId: user.id, type: 'SYSTEM', title: '알림' },
      });
      await t.prisma.recentView.create({
        data: { userId: user.id, targetType: 'COMPLEX', targetId: complex.id },
      });
      await t.prisma.favoriteComplex.create({ data: { userId: user.id, complexId: complex.id } });
      await t.prisma.favoriteListing.create({ data: { userId: user.id, listingId: listing.id } });
      // home module data (no FK to users → nothing cascades; HomeUserDataService.purge)
      await t.prisma.favoriteAgency.create({ data: { userId: user.id, agencyId: agency.id } });
      await t.prisma.userInterestRegion.create({
        data: { userId: user.id, regionKeys: ['sindae'], notify: true },
      });
      // another member's rows are untouched
      const other = await createUser(t.prisma);
      await t.prisma.favoriteAgency.create({ data: { userId: other.id, agencyId: agency.id } });
      await t.prisma.userInterestRegion.create({
        data: { userId: other.id, regionKeys: ['yeonhyang'] },
      });

      await withSession(t.http().post('/api/v1/me/withdraw'), s)
        .send({ confirm: true })
        .expect(204);

      const [request] = await t.prisma.$queryRaw<
        {
          status: string;
          contact_name: string;
          contact_phone: string;
          address_detail: string | null;
        }[]
      >`SELECT status::text, contact_name, contact_phone, address_detail
          FROM deal_requests WHERE id = ${requestId}::uuid`;
      expect(request).toEqual({
        status: 'CANCELLED',
        contact_name: '',
        contact_phone: '',
        address_detail: null,
      });
      const [grant] = await t.prisma.$queryRaw<{ revoked: boolean }[]>`
        SELECT revoked_at IS NOT NULL AS revoked FROM deal_request_contact_grants
         WHERE deal_request_id = ${requestId}::uuid`;
      expect(grant?.revoked).toBe(true);
      // kept during the grace period, erased by the scrub job
      expect(await t.prisma.favoriteAgency.count({ where: { userId: user.id } })).toBe(1);

      await t.app.get(PiiScrubService).scrubDue(new Date(Date.now() + 31 * 86_400_000));
      const report = await t.prisma.report.findFirstOrThrow({ where: { reporterUserId: user.id } });
      expect(report).toMatchObject({ reporterPhone: null, ip: null });
      const where = { where: { userId: user.id } };
      expect(await t.prisma.notification.count(where)).toBe(0);
      expect(await t.prisma.recentView.count(where)).toBe(0);
      expect(await t.prisma.favoriteComplex.count(where)).toBe(0);
      expect(await t.prisma.favoriteListing.count(where)).toBe(0);
      expect(await t.prisma.favoriteAgency.count(where)).toBe(0);
      expect(await t.prisma.userInterestRegion.count(where)).toBe(0);
      const others = { where: { userId: other.id } };
      expect(await t.prisma.favoriteAgency.count(others)).toBe(1);
      expect(await t.prisma.userInterestRegion.count(others)).toBe(1);
    });

    it('409 while the member still runs an agency; staff memberships are detached', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const s = await loginUser(
        t.app,
        { id: owner.id, role: UserRole.AGENCY_OWNER },
        { agencyId: agency.id },
      );
      const res = await withSession(t.http().post('/api/v1/me/withdraw'), s)
        .send({ confirm: true })
        .expect(409);
      expect(res.body.code).toBe(ErrorCode.AUTH_WITHDRAW_AGENCY_OWNER);

      const staff = await createUser(t.prisma, { role: UserRole.AGENT });
      await t.prisma.agencyMember.create({
        data: { agencyId: agency.id, userId: staff.id, role: 'AGENT', displayName: '직원' },
      });
      const ss = await loginUser(
        t.app,
        { id: staff.id, role: UserRole.AGENT },
        { agencyId: agency.id },
      );
      await withSession(t.http().post('/api/v1/me/withdraw'), ss)
        .send({ confirm: true })
        .expect(204);
      const m = await t.prisma.agencyMember.findFirstOrThrow({ where: { userId: staff.id } });
      expect(m.status).toBe('REMOVED');
    });

    it('the scrub job erases former staff rows (name, title, phone, license number)', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const staff = await createUser(t.prisma, { role: UserRole.AGENT });
      await t.prisma.agencyMember.create({
        data: {
          agencyId: agency.id,
          userId: staff.id,
          role: 'AGENT',
          displayName: '김직원',
          title: '실장',
          phone: '01077778888',
          isLicensed: true,
          licenseNumber: '46150-2026-00077',
        },
      });
      const ss = await loginUser(
        t.app,
        { id: staff.id, role: UserRole.AGENT },
        { agencyId: agency.id },
      );
      await withSession(t.http().post('/api/v1/me/withdraw'), ss)
        .send({ confirm: true })
        .expect(204);
      await t.app.get(PiiScrubService).scrubDue(new Date(Date.now() + 31 * 86_400_000));

      const m = await t.prisma.agencyMember.findFirstOrThrow({ where: { userId: staff.id } });
      expect(m).toMatchObject({
        status: 'REMOVED',
        displayName: '탈퇴 회원',
        title: null,
        phone: null,
        licenseNumber: null,
      });
      const os = await loginUser(
        t.app,
        { id: owner.id, role: UserRole.AGENCY_OWNER },
        { agencyId: agency.id },
      );
      const list = await withSession(
        t.http().get('/api/v1/agencies/mine/members').query({ includeRemoved: 'true' }),
        os,
      ).expect(200);
      const body = JSON.stringify(list.body);
      expect(body).not.toContain('김직원');
      expect(body).not.toContain('01077778888');
      expect(body).not.toContain('46150-2026-00077');
      // the office's own (active) member rows are untouched
      const ownerRow = await t.prisma.agencyMember.findFirstOrThrow({
        where: { userId: owner.id },
      });
      expect(ownerRow.displayName).toBe(agency.representativeName);
    });

    it('400 without explicit confirmation', async () => {
      const { s } = await member();
      const res = await withSession(t.http().post('/api/v1/me/withdraw'), s)
        .send({ reason: 'x' })
        .expect(400);
      expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });

    it('401 without a session', async () => {
      await t
        .http()
        .post('/api/v1/me/withdraw')
        .set('Origin', WEB_ORIGIN)
        .send({ confirm: true })
        .expect(401);
    });
  });

  describe('GET /api/v1/terms', () => {
    it('lists the current version per type (published + effective only)', async () => {
      const terms = await seedTerms(t.prisma);
      await t.prisma.termsDocument.create({
        data: {
          type: TermsType.SERVICE,
          version: '9.0',
          title: '예정 약관',
          content: '...',
          isRequired: true,
          effectiveAt: new Date(Date.now() + 7 * 86_400_000),
          publishedAt: new Date(),
        },
      });
      await t.prisma.termsDocument.create({
        data: {
          type: TermsType.PRIVACY,
          version: 'draft',
          title: '초안',
          content: '...',
          isRequired: true,
          effectiveAt: new Date(Date.now() - 1000),
        },
      });
      const res = await t.http().get('/api/v1/terms').expect(200);
      expect((res.body as { id: string }[]).map((d) => d.id)).toEqual([
        terms.service.id,
        terms.privacy.id,
        terms.location.id,
        terms.marketing.id,
      ]);
      expect(res.body[0]).not.toHaveProperty('content');
    });

    it('lists account terms only (purpose consents are read per type)', async () => {
      const terms = await seedTerms(t.prisma);
      await createActionConsentTerms(t.prisma);
      const res = await t.http().get('/api/v1/terms').expect(200);
      expect((res.body as { id: string }[]).map((d) => d.id)).toEqual([
        terms.service.id,
        terms.privacy.id,
        terms.location.id,
        terms.marketing.id,
      ]);
    });
  });

  describe('GET /api/v1/terms/:type', () => {
    it('returns the current document, or a past published version', async () => {
      const terms = await seedTerms(t.prisma);
      const res = await t.http().get('/api/v1/terms/privacy').expect(200);
      expect(res.body).toMatchObject({ id: terms.privacy.id, content: expect.any(String) });
      const v = await t
        .http()
        .get('/api/v1/terms/PRIVACY')
        .query({ version: terms.privacy.version })
        .expect(200);
      expect(v.body.id).toBe(terms.privacy.id);
    });

    it('serves the purpose-consent documents (D8) by type, in any spelling', async () => {
      const docs = await createActionConsentTerms(t.prisma);
      const byType = new Map(docs.map((d) => [d.type, d]));
      for (const [path, type] of [
        ['PRIVACY_AGENCY_APPLICATION', TermsType.PRIVACY_AGENCY_APPLICATION],
        ['privacy_agency_join', TermsType.PRIVACY_AGENCY_JOIN],
        ['deal-request-privacy', TermsType.DEAL_REQUEST_PRIVACY],
        ['DEAL-REQUEST-PROVIDE', TermsType.DEAL_REQUEST_PROVIDE],
      ] as const) {
        const res = await t.http().get(`/api/v1/terms/${path}`).expect(200);
        expect(res.body).toMatchObject({
          id: byType.get(type)?.id,
          type,
          version: '1.0',
          isRequired: true,
          content: expect.any(String),
        });
      }
    });

    it('404 when nothing is published; 400 for an unknown type or bad version', async () => {
      const none = await t.http().get('/api/v1/terms/service').expect(404);
      expect(none.body.code).toBe(ErrorCode.AUTH_TERMS_NOT_FOUND);
      await t.http().get('/api/v1/terms/cookies').expect(400);
      await t.http().get('/api/v1/terms/service').query({ version: "1' OR 1=1" }).expect(400);
    });
  });
});
