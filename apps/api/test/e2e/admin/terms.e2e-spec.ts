import { AdminRole, ErrorCode, TERMS_NOTICE_DAYS, TermsType } from '@house/shared';
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
    effectiveAt: isoIn(1),
    ...overrides,
  });

  /** Time passes: the published version's effectiveAt is reached. */
  const reachEffectiveAt = (id: string) =>
    t.prisma.termsDocument.update({
      where: { id },
      data: { effectiveAt: new Date(Date.now() - 1000) },
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
    const created = await as(t, admin, 'post', '/admin/terms')
      .send(draft({ effectiveAt: isoIn(8) }))
      .expect(201);
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
    // Scheduled with advance notice: published now, current from its effectiveAt.
    expect(published.body).toMatchObject({ isCurrent: false, requiresReconsent: true });
    expect(published.body.publishedAt).not.toBeNull();
    const audits = await auditRows(t, 'terms.publish');
    expect(audits).toHaveLength(1);
    expect(audits[0]?.before).toMatchObject({ publishedAt: null });
    expect(audits[0]?.after).toMatchObject({ urgent: false, urgentReason: null, noticeDays: 7 });
    const notice = await withSession(t.http().get(api('/auth/me')), session).expect(200);
    expect(notice.body.pendingRequiredTerms).toEqual([]);

    await reachEffectiveAt(created.body.id as string);
    const after = await withSession(t.http().get(api('/auth/me')), session).expect(200);
    expect(after.body.pendingRequiredTerms).toEqual([TermsType.SERVICE]);
    expect(
      (await as(t, admin, 'get', `/admin/terms/${created.body.id}`).expect(200)).body,
    ).toMatchObject({ isCurrent: true });

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

    // Not later than the published version (both in the future).
    const older = await as(t, admin, 'post', '/admin/terms')
      .send(draft({ version: '1.9', effectiveAt: isoIn(0.5) }))
      .expect(201);
    const notAfter = await as(t, admin, 'post', `/admin/terms/${older.body.id}/publish`).expect(
      400,
    );
    expectCode(notAfter, ErrorCode.TERMS_EFFECTIVE_AT_INVALID);
    expect(notAfter.body.details).toMatchObject({ reason: 'NOT_AFTER_LATEST' });
    // A scheduled (future) version is published but not current yet.
    const scheduled = await as(t, admin, 'post', '/admin/terms')
      .send(draft({ version: '3.0', effectiveAt: isoIn(10) }))
      .expect(201);
    const pub = await as(t, admin, 'post', `/admin/terms/${scheduled.body.id}/publish`).expect(200);
    expect(pub.body).toMatchObject({ isCurrent: false, requiresReconsent: true });

    await as(t, admin, 'delete', `/admin/terms/${older.body.id}`).expect(204);
    await as(t, admin, 'get', `/admin/terms/${older.body.id}`).expect(404);
  });

  it('never publishes retroactively, even the first version of a type', async () => {
    const { session: admin } = await adminActor(t, AdminRole.ADMIN);
    const past = await as(t, admin, 'post', '/admin/terms')
      .send(draft({ effectiveAt: isoIn(-1) }))
      .expect(201);
    const res = await as(t, admin, 'post', `/admin/terms/${past.body.id}/publish`)
      .send({ urgent: true, reason: '법령 개정에 따른 긴급 변경' })
      .expect(400);
    expectCode(res, ErrorCode.TERMS_EFFECTIVE_AT_INVALID);
    expect(res.body.details).toMatchObject({ reason: 'PAST' });
    expect(await t.prisma.termsDocument.count({ where: { publishedAt: { not: null } } })).toBe(0);
    expect(await auditRows(t, 'terms.publish')).toHaveLength(0);
  });

  it(`a revision needs ${TERMS_NOTICE_DAYS} days of advance notice unless urgent (with a reason, audited)`, async () => {
    const { session: admin } = await adminActor(t, AdminRole.ADMIN);
    // The first version of a type has nothing to give notice about.
    const first = await as(t, admin, 'post', '/admin/terms').send(draft()).expect(201);
    await as(t, admin, 'post', `/admin/terms/${first.body.id}/publish`).expect(200);

    const soon = await as(t, admin, 'post', '/admin/terms')
      .send(draft({ version: '2.1', effectiveAt: isoIn(3) }))
      .expect(201);
    const tooSoon = await as(t, admin, 'post', `/admin/terms/${soon.body.id}/publish`).expect(400);
    expectCode(tooSoon, ErrorCode.TERMS_EFFECTIVE_AT_INVALID);
    expect(tooSoon.body.details).toMatchObject({
      reason: 'NOTICE_PERIOD',
      noticeDays: TERMS_NOTICE_DAYS,
    });
    // urgent without a reason is a validation error
    await as(t, admin, 'post', `/admin/terms/${soon.body.id}/publish`)
      .send({ urgent: true })
      .expect(400);
    await as(t, admin, 'post', `/admin/terms/${soon.body.id}/publish`)
      .send({ urgent: 'yes', reason: '법령 개정에 따른 긴급 변경' })
      .expect(400);

    const urgent = await as(t, admin, 'post', `/admin/terms/${soon.body.id}/publish`)
      .send({ urgent: true, reason: '법령 개정에 따른 긴급 변경' })
      .expect(200);
    expect(urgent.body.publishedAt).not.toBeNull();
    const [, audit] = await auditRows(t, 'terms.publish');
    expect(audit).toMatchObject({ resourceId: soon.body.id });
    expect(audit?.after).toMatchObject({
      urgent: true,
      urgentReason: '법령 개정에 따른 긴급 변경',
      noticeDays: 2,
    });
    expect(JSON.stringify(audit?.after)).not.toContain('제1조');
  });

  it('authors purpose consents (D8): current in the admin list, never pending at /auth/me', async () => {
    const { session: admin } = await adminActor(t, AdminRole.ADMIN);
    const created = await as(t, admin, 'post', '/admin/terms')
      .send(
        draft({
          type: TermsType.DEAL_REQUEST_PROVIDE,
          version: '1.0',
          title: '[필수] 개인정보 제3자 제공 동의',
        }),
      )
      .expect(201);
    await as(t, admin, 'post', `/admin/terms/${created.body.id}/publish`).expect(200);
    await reachEffectiveAt(created.body.id as string);

    const detail = await as(t, admin, 'get', `/admin/terms/${created.body.id}`).expect(200);
    expect(detail.body).toMatchObject({
      type: TermsType.DEAL_REQUEST_PROVIDE,
      isCurrent: true,
      isRequired: true,
    });
    const pub = await t.http().get(api('/terms/deal-request-provide')).expect(200);
    expect(pub.body).toMatchObject({ id: created.body.id, version: '1.0' });
    // Agreed per submission, so it never blocks a member or shows up as an account term.
    const me = await withSession(t.http().get(api('/auth/me')), userSession).expect(200);
    expect(me.body.pendingRequiredTerms).toEqual([]);
    expect((await t.http().get(api('/terms')).expect(200)).body).toEqual([]);
  });

  it('marketing and location consent can never be made required', async () => {
    const { session: admin } = await adminActor(t, AdminRole.ADMIN);
    for (const type of [TermsType.MARKETING, TermsType.LOCATION]) {
      await as(t, admin, 'post', '/admin/terms')
        .send(draft({ type, isRequired: true }))
        .expect(400);
      const optional = await as(t, admin, 'post', '/admin/terms')
        .send(draft({ type, isRequired: false }))
        .expect(201);
      expectCode(
        await as(t, admin, 'patch', `/admin/terms/${optional.body.id}`)
          .send({ isRequired: true })
          .expect(400),
        ErrorCode.TERMS_OPTIONAL_ONLY,
      );
      expect(
        (await t.prisma.termsDocument.findUniqueOrThrow({ where: { id: optional.body.id } }))
          .isRequired,
      ).toBe(false);
    }
    // A draft stored as required before the rule existed cannot be published.
    const legacy = await t.prisma.termsDocument.create({
      data: {
        type: TermsType.MARKETING,
        version: '9.0',
        title: '마케팅 정보 수신 동의',
        content: '광고성 정보',
        isRequired: true,
        effectiveAt: new Date(Date.now() + DAY),
      },
    });
    const res = await as(t, admin, 'post', `/admin/terms/${legacy.id}/publish`).expect(400);
    expectCode(res, ErrorCode.TERMS_OPTIONAL_ONLY);
    expect(res.body.details).toMatchObject({ type: TermsType.MARKETING });
    expect(
      (await t.prisma.termsDocument.findUniqueOrThrow({ where: { id: legacy.id } })).publishedAt,
    ).toBeNull();
    // Unsetting the flag on that draft is allowed, then it publishes as an optional consent.
    await as(t, admin, 'patch', `/admin/terms/${legacy.id}`)
      .send({ isRequired: false })
      .expect(200);
    const pub = await as(t, admin, 'post', `/admin/terms/${legacy.id}/publish`).expect(200);
    expect(pub.body).toMatchObject({ isRequired: false, requiresReconsent: false });
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
    await as(t, admin, 'post', '/admin/terms')
      .send(draft({ content: '제1조 <a href="javascript:alert(1)">목적</a>' }))
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
