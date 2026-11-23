import { AdminRole, ErrorCode, TermsType } from '@house/shared';
import {
  createAdmin,
  createUser,
  loginAdmin,
  loginUser,
  resetAll,
  type TestApp,
  type TestSession,
  withSession,
} from '../../utils';
import { createDealRequestsApp, sellBody } from '../deal-requests/factories';
import { createTerms, seedTerms, WEB_ORIGIN } from './helpers';

/** TermsConsentGuard: a newly effective required terms version blocks a member's writes. */
describe('auth: required terms re-consent is enforced server-side (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    ({ t } = await createDealRequestsApp());
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  /** A member who agreed to every current required document. */
  async function consentedMember(): Promise<{ userId: string; s: TestSession }> {
    const terms = await seedTerms(t.prisma);
    const user = await createUser(t.prisma);
    await t.prisma.userConsent.createMany({
      data: [terms.service, terms.privacy, terms.location].map((d) => ({
        userId: user.id,
        termsDocumentId: d.id,
        agreed: true,
      })),
    });
    return { userId: user.id, s: await loginUser(t.app, user) };
  }

  const createRequest = (s: TestSession) =>
    withSession(t.http().post('/api/v1/deal-requests'), s).send(sellBody());

  it('403 AUTH_TERMS_REQUIRED after a required v2 takes effect, until the member agrees', async () => {
    const { s } = await consentedMember();
    await createRequest(s).expect(201);

    const v2 = await createTerms(t.prisma, {
      type: TermsType.SERVICE,
      version: '2.0',
      effectiveAt: new Date(Date.now() - 1000),
      publishedAt: new Date(Date.now() - 1000),
    });
    const blocked = await createRequest(s).expect(403);
    expect(blocked.body).toMatchObject({
      code: ErrorCode.AUTH_TERMS_REQUIRED,
      details: { missing: [TermsType.SERVICE] },
    });
    expect(await t.prisma.dealRequest.count()).toBe(1);

    // reads, the account and the consent endpoints stay usable
    const me = await withSession(t.http().get('/api/v1/auth/me'), s).expect(200);
    expect(me.body.pendingRequiredTerms).toEqual([TermsType.SERVICE]);
    await withSession(t.http().patch('/api/v1/me/profile'), s)
      .send({ nickname: '동의전' })
      .expect(200);
    await withSession(t.http().post('/api/v1/me/consents'), s)
      .send({ consents: [{ termsDocumentId: v2.id, agreed: true }] })
      .expect(200);

    await createRequest(s).expect(201);
    expect(await t.prisma.dealRequest.count()).toBe(2);
  });

  it('a member with no consent records (legacy) is told every missing required type', async () => {
    await seedTerms(t.prisma);
    const s = await loginUser(t.app, await createUser(t.prisma));
    const res = await createRequest(s).expect(403);
    expect(res.body.details.missing).toEqual([
      TermsType.SERVICE,
      TermsType.PRIVACY,
      TermsType.LOCATION,
    ]);
  });

  it('a published version that is not effective yet does not block', async () => {
    const { s } = await consentedMember();
    await createTerms(t.prisma, {
      type: TermsType.PRIVACY,
      version: '2.0',
      effectiveAt: new Date(Date.now() + 7 * 86_400_000),
      publishedAt: new Date(),
    });
    await createRequest(s).expect(201);
  });

  it('a new optional (marketing) version does not block', async () => {
    const { s } = await consentedMember();
    await createTerms(t.prisma, {
      type: TermsType.MARKETING,
      version: '2.0',
      isRequired: false,
      effectiveAt: new Date(Date.now() - 1000),
    });
    await createRequest(s).expect(201);
  });

  it('admin sessions are not subject to member terms', async () => {
    await seedTerms(t.prisma);
    const admin = await createAdmin(t.prisma, { role: AdminRole.ADMIN });
    const adminSession = await loginAdmin(t.app, { id: admin.id, role: AdminRole.ADMIN });
    await withSession(t.http().post('/api/v1/admin/auth/logout'), adminSession).expect(204);
  });

  it('401 without a session; 400 for an invalid body still comes after the terms check', async () => {
    await t
      .http()
      .post('/api/v1/deal-requests')
      .set('Origin', WEB_ORIGIN)
      .send(sellBody())
      .expect(401);
    const { s } = await consentedMember();
    const bad = await withSession(t.http().post('/api/v1/deal-requests'), s)
      .send({ type: 'NOPE' })
      .expect(400);
    expect(bad.body.code).toBe(ErrorCode.VALIDATION_FAILED);
  });
});
