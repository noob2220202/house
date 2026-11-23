import { ErrorCode, TermsType, UserRole, UserStatus } from '@house/shared';
import { PiiScrubService } from '../../../src/modules/auth/jobs/pii-scrub.service';
import {
  createAgency,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import { createAuthTestApp, seedTerms, WEB_ORIGIN } from './helpers';

describe('auth: /me account endpoints (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    ({ t } = await createAuthTestApp());
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
    it('soft-deletes, logs out everywhere, frees the social account; the scrub job erases PII later', async () => {
      const terms = await seedTerms(t.prisma);
      const { user, s } = await member(['KAKAO', 'NAVER']);
      await t.prisma.userConsent.create({
        data: { userId: user.id, termsDocumentId: terms.service.id, agreed: true, ip: '1.2.3.4' },
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

    it('404 when nothing is published; 400 for an unknown type or bad version', async () => {
      const none = await t.http().get('/api/v1/terms/service').expect(404);
      expect(none.body.code).toBe(ErrorCode.AUTH_TERMS_NOT_FOUND);
      await t.http().get('/api/v1/terms/cookies').expect(400);
      await t.http().get('/api/v1/terms/service').query({ version: "1' OR 1=1" }).expect(400);
    });
  });
});
