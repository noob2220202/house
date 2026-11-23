import { AdminRole, ErrorCode, TermsType } from '@house/shared';
import {
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  type TestApp,
  type TestSession,
  withSession,
} from '../../utils';
import { adminActor, api, as, auditRows, expectAdminAuthz, expectCode, pluck } from './helpers';

const DAY = 86_400_000;
const isoIn = (days: number): string => new Date(Date.now() + days * DAY).toISOString();

describe('admin terms (e2e)', () => {
  let t: TestApp;
  let userSession: TestSession;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    userSession = await loginUser(t.app, await createUser(t.prisma));
  });
  afterAll(() => t?.close());

  const draft = (overrides: object = {}) => ({
    type: TermsType.SERVICE,
    version: '2.0',
    title: '서비스 이용약관',
    content: '제1조 (목적) …',
    isRequired: true,
    effectiveAt: isoIn(-1),
    ...overrides,
  });

  it('draft → edit → publish; a new required version asks users to agree again', async () => {
    const user = await createUser(t.prisma);
    const v1 = await t.prisma.termsDocument.create({
      data: {
        type: TermsType.SERVICE,
        version: '1.0',
        title: '이용약관',
        content: 'v1',
        isRequired: true,
        effectiveAt: new Date(Date.now() - 30 * DAY),
        publishedAt: new Date(Date.now() - 30 * DAY),
      },
    });
    await t.prisma.userConsent.create({
      data: { userId: user.id, termsDocumentId: v1.id, agreed: true },
    });
    const session = await loginUser(t.app, user);
    const before = await withSession(t.http().get(api('/auth/me')), session).expect(200);
    expect(before.body.pendingRequiredTerms).toEqual([]);

    const { session: admin } = await adminActor(t, AdminRole.ADMIN);
    const created = await as(t, admin, 'post', '/admin/terms').send(draft()).expect(201);
    expect(created.body).toMatchObject({
      publishedAt: null,
      isCurrent: false,
      requiresReconsent: false,
    });
    const edited = await as(t, admin, 'patch', `/admin/terms/${created.body.id}`)
      .send({ title: '서비스 이용약관 (개정)' })
      .expect(200);
    expect(edited.body.title).toBe('서비스 이용약관 (개정)');

    const published = await as(t, admin, 'post', `/admin/terms/${created.body.id}/publish`).expect(
      200,
    );
    expect(published.body).toMatchObject({ isCurrent: true, requiresReconsent: true });
    expect(published.body.publishedAt).not.toBeNull();
    expect((await auditRows(t, 'terms.publish'))[0]?.before).toMatchObject({ publishedAt: null });

    const after = await withSession(t.http().get(api('/auth/me')), session).expect(200);
    expect(after.body.pendingRequiredTerms).toEqual([TermsType.SERVICE]);

    const list = await as(t, admin, 'get', '/admin/terms?type=SERVICE&published=true').expect(200);
    expect(pluck(list.body.items, 'version')).toEqual(['2.0', '1.0']);
    expect(list.body.items[1]).toMatchObject({ isCurrent: false, consentCount: 1 });
    await as(t, admin, 'get', `/admin/terms/${v1.id}`).expect(200);
  });

  it('published versions are immutable; versions stay ordered', async () => {
    const { session: admin } = await adminActor(t, AdminRole.ADMIN);
    const first = await as(t, admin, 'post', '/admin/terms').send(draft()).expect(201);
    await as(t, admin, 'post', `/admin/terms/${first.body.id}/publish`).expect(200);

    expectCode(
      await as(t, admin, 'patch', `/admin/terms/${first.body.id}`).send({ title: 'x' }).expect(409),
      ErrorCode.TERMS_ALREADY_PUBLISHED,
    );
    await as(t, admin, 'post', `/admin/terms/${first.body.id}/publish`).expect(409);
    await as(t, admin, 'delete', `/admin/terms/${first.body.id}`).expect(409);
    expectCode(
      await as(t, admin, 'post', '/admin/terms').send(draft()).expect(409),
      ErrorCode.TERMS_VERSION_DUPLICATE,
    );

    const older = await as(t, admin, 'post', '/admin/terms')
      .send(draft({ version: '1.9', effectiveAt: isoIn(-5) }))
      .expect(201);
    expectCode(
      await as(t, admin, 'post', `/admin/terms/${older.body.id}/publish`).expect(400),
      ErrorCode.TERMS_EFFECTIVE_AT_INVALID,
    );
    // A scheduled (future) version is published but not current yet.
    const scheduled = await as(t, admin, 'post', '/admin/terms')
      .send(draft({ version: '3.0', effectiveAt: isoIn(10) }))
      .expect(201);
    const pub = await as(t, admin, 'post', `/admin/terms/${scheduled.body.id}/publish`).expect(200);
    expect(pub.body).toMatchObject({ isCurrent: false, requiresReconsent: true });

    await as(t, admin, 'delete', `/admin/terms/${older.body.id}`).expect(204);
    await as(t, admin, 'get', `/admin/terms/${older.body.id}`).expect(404);
  });

  it('validation failures (400)', async () => {
    const { session: admin } = await adminActor(t, AdminRole.ADMIN);
    await as(t, admin, 'post', '/admin/terms')
      .send(draft({ version: '1 0' }))
      .expect(400);
    await as(t, admin, 'post', '/admin/terms')
      .send(draft({ type: 'NOPE' }))
      .expect(400);
    await as(t, admin, 'post', '/admin/terms')
      .send(draft({ effectiveAt: '2026-01-01' }))
      .expect(400);
    const { body } = await as(t, admin, 'post', '/admin/terms').send(draft()).expect(201);
    await as(t, admin, 'patch', `/admin/terms/${body.id}`).send({}).expect(400);
    await as(t, admin, 'get', '/admin/terms?published=maybe').expect(400);
    await as(t, admin, 'post', '/admin/terms/not-an-id/publish').expect(400);
  });

  it('authz: ADMIN+ only', async () => {
    const opts = { userSession, lowRole: AdminRole.OPERATOR };
    await expectAdminAuthz(t, 'get', '/admin/terms', opts);
    await expectAdminAuthz(t, 'post', '/admin/terms', { ...opts, body: draft() });
    const { session: admin } = await adminActor(t, AdminRole.ADMIN);
    const { body } = await as(t, admin, 'post', '/admin/terms').send(draft()).expect(201);
    await expectAdminAuthz(t, 'get', `/admin/terms/${body.id}`, opts);
    await expectAdminAuthz(t, 'patch', `/admin/terms/${body.id}`, {
      ...opts,
      body: { title: 'x' },
    });
    await expectAdminAuthz(t, 'post', `/admin/terms/${body.id}/publish`, opts);
    await expectAdminAuthz(t, 'delete', `/admin/terms/${body.id}`, opts);
  });
});
