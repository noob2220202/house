import {
  AdminRole,
  AgencySiteStatus,
  AgencyStatus,
  ErrorCode,
  NotificationType,
  SubscriptionProduct,
  UserRole,
  kstDate,
} from '@house/shared';
import type { Agency, User } from '@prisma/client';
import {
  createAdmin,
  createAgency,
  createTestApp,
  createUser,
  loginAdmin,
  loginUser,
  resetAll,
  withConfig,
  withSession,
  type TestApp,
  type TestSession,
} from '../../utils';
import { createAgencySite, createAgent, createSubscription, pluck } from './helpers';

const SITE_HOST = (slug: string) => `http://${slug}.localhost:3000`;

describe('agencies: 사무소 홈페이지 + 이용권 (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function office(data: Partial<Parameters<typeof createAgency>[1]> = {}) {
    const { agency, owner } = await createAgency(t.prisma, data);
    const s = await loginUser(
      t.app,
      { id: owner.id, role: UserRole.AGENCY_OWNER },
      { agencyId: agency.id },
    );
    return { agency, owner, s };
  }

  async function staffOf(agency: Agency): Promise<TestSession> {
    const { user } = await createAgent(t.prisma, agency.id);
    return loginUser(t.app, { id: user.id, role: UserRole.AGENT }, { agencyId: agency.id });
  }

  async function admin(role: AdminRole = AdminRole.OPERATOR) {
    const a = await createAdmin(t.prisma, { role });
    return loginAdmin(t.app, { id: a.id, role });
  }

  const today = () => kstDate();

  // ---------- owner console ----------

  describe('GET /api/v1/agencies/mine/site', () => {
    it('200: no site yet, root domain and the (off) subscription line', async () => {
      const { s } = await office();
      const res = await withSession(t.http().get('/api/v1/agencies/mine/site'), s).expect(200);
      expect(res.body).toEqual({
        site: null,
        rootDomain: 'localhost',
        subscription: { required: false, active: false, endsOn: null },
      });
    });

    it('200: an active site with its office host URL (dev: https counts as ready); staff may read', async () => {
      const { agency, s } = await office();
      const site = await createAgencySite(t.prisma, agency.id, {
        slug: 'gangnam',
        httpsReadyAt: null,
        color: 'GREEN',
        tagline: '역 앞 10년',
      });
      const res = await withSession(t.http().get('/api/v1/agencies/mine/site'), s).expect(200);
      expect(res.body.site).toMatchObject({
        id: site.id,
        agencyId: agency.id,
        status: 'ACTIVE',
        slug: 'gangnam',
        color: 'GREEN',
        tagline: '역 앞 10년',
        url: SITE_HOST('gangnam'),
        httpsReady: true,
        live: true,
      });
      const staff = await staffOf(agency);
      const asStaff = await withSession(t.http().get('/api/v1/agencies/mine/site'), staff).expect(
        200,
      );
      expect(asStaff.body.site.id).toBe(site.id);
    });

    it('401 anonymous, 403 for a user without an office or a suspended office', async () => {
      await t.http().get('/api/v1/agencies/mine/site').expect(401);
      const user = await loginUser(t.app, await createUser(t.prisma));
      await withSession(t.http().get('/api/v1/agencies/mine/site'), user).expect(403);
      const { s } = await office({ status: AgencyStatus.SUSPENDED });
      const res = await withSession(t.http().get('/api/v1/agencies/mine/site'), s).expect(403);
      expect(res.body.code).toBe(ErrorCode.AGENCY_NOT_APPROVED);
    });
  });

  describe('GET /api/v1/agencies/mine/site/availability', () => {
    it('200: available / INVALID / RESERVED / TAKEN (own request stays available)', async () => {
      const { agency, s } = await office();
      const other = await createAgency(t.prisma);
      const third = await createAgency(t.prisma);
      await createAgencySite(t.prisma, other.agency.id, { slug: 'taken-live' });
      await createAgencySite(t.prisma, third.agency.id, {
        status: AgencySiteStatus.REQUESTED,
        requestedSlug: 'taken-open',
      });
      await createAgencySite(t.prisma, agency.id, {
        status: AgencySiteStatus.REQUESTED,
        requestedSlug: 'mine-open',
      });
      const check = async (slug: string): Promise<unknown> =>
        (
          await withSession(
            t.http().get(`/api/v1/agencies/mine/site/availability?slug=${slug}`),
            s,
          ).expect(200)
        ).body;
      expect(await check('Free-One')).toEqual({ slug: 'free-one', available: true, reason: null });
      expect(await check('admin')).toEqual({ slug: 'admin', available: false, reason: 'RESERVED' });
      expect(await check('a--b')).toMatchObject({ available: false, reason: 'INVALID' });
      expect(await check('taken-live')).toMatchObject({ available: false, reason: 'TAKEN' });
      expect(await check('taken-open')).toMatchObject({ available: false, reason: 'TAKEN' });
      expect(await check('mine-open')).toMatchObject({ available: true, reason: null });
    });

    it('403 for staff, 400 without a slug', async () => {
      const { agency, s } = await office();
      const staff = await staffOf(agency);
      await withSession(
        t.http().get('/api/v1/agencies/mine/site/availability?slug=abc'),
        staff,
      ).expect(403);
      await withSession(t.http().get('/api/v1/agencies/mine/site/availability'), s).expect(400);
    });
  });

  describe('POST /api/v1/agencies/mine/site', () => {
    it('200: requests, changes the request and re-requests after a rejection (audited)', async () => {
      const { agency, s } = await office();
      const first = await withSession(t.http().post('/api/v1/agencies/mine/site'), s)
        .send({ slug: ' Gangnam ', color: 'NAVY', tagline: '역 앞 10년' })
        .expect(200);
      expect(first.body.site).toMatchObject({
        status: 'REQUESTED',
        slug: null,
        requestedSlug: 'gangnam',
        color: 'NAVY',
        tagline: '역 앞 10년',
        url: null,
        live: false,
        decidedAt: null,
      });
      const changed = await withSession(t.http().post('/api/v1/agencies/mine/site'), s)
        .send({ slug: 'gangnam-2' })
        .expect(200);
      // Colour and 한 줄 소개 are kept when not sent.
      expect(changed.body.site).toMatchObject({
        requestedSlug: 'gangnam-2',
        color: 'NAVY',
        tagline: '역 앞 10년',
      });
      await t.prisma.agencySite.update({
        where: { agencyId: agency.id },
        data: { status: AgencySiteStatus.REJECTED, decisionReason: '상호와 무관한 주소' },
      });
      const again = await withSession(t.http().post('/api/v1/agencies/mine/site'), s)
        .send({ slug: 'sunshine', tagline: '' })
        .expect(200);
      expect(again.body.site).toMatchObject({
        status: 'REQUESTED',
        requestedSlug: 'sunshine',
        tagline: null,
        decisionReason: null,
      });
      const audits = await t.prisma.auditLog.findMany({
        where: { action: 'agency_site.request' },
        orderBy: { createdAt: 'asc' },
      });
      expect(audits).toHaveLength(3);
      expect(audits[0]).toMatchObject({ actorType: 'USER', resourceType: 'AgencySite' });
    });

    it('409 while ACTIVE / SUSPENDED, and for a slug another office holds', async () => {
      const { agency, s } = await office();
      const other = await createAgency(t.prisma);
      await createAgencySite(t.prisma, other.agency.id, { slug: 'taken-live' });
      const dup = await withSession(t.http().post('/api/v1/agencies/mine/site'), s)
        .send({ slug: 'taken-live' })
        .expect(409);
      expect(dup.body.code).toBe(ErrorCode.AGENCY_SITE_SLUG_DUPLICATE);
      await createAgencySite(t.prisma, agency.id, { status: AgencySiteStatus.SUSPENDED });
      const active = await withSession(t.http().post('/api/v1/agencies/mine/site'), s)
        .send({ slug: 'brand-new' })
        .expect(409);
      expect(active.body.code).toBe(ErrorCode.AGENCY_SITE_ALREADY_ACTIVE);
    });

    it('400 for reserved / invalid slugs and colours; 403 staff; 401 anonymous', async () => {
      const { agency, s } = await office();
      for (const body of [
        { slug: 'admin' },
        { slug: 'ab' },
        { slug: 'xn--abc' },
        {},
        { slug: 'okay-slug', color: 'PINK' },
      ]) {
        const res = await withSession(t.http().post('/api/v1/agencies/mine/site'), s)
          .send(body)
          .expect(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      }
      const staff = await staffOf(agency);
      await withSession(t.http().post('/api/v1/agencies/mine/site'), staff)
        .send({ slug: 'okay-slug' })
        .expect(403);
      await t.http().post('/api/v1/agencies/mine/site').send({ slug: 'okay-slug' }).expect(401);
      expect(await t.prisma.agencySite.count()).toBe(0);
    });
  });

  describe('PATCH /api/v1/agencies/mine/site', () => {
    it('200: colour / 한 줄 소개, visible on the public site at once (cache bumped)', async () => {
      const { agency, s } = await office();
      await createAgencySite(t.prisma, agency.id, { slug: 'gangnam', tagline: '옛 소개' });
      expect((await t.http().get('/api/v1/sites/gangnam').expect(200)).body.tagline).toBe(
        '옛 소개',
      );
      const res = await withSession(t.http().patch('/api/v1/agencies/mine/site'), s)
        .send({ color: 'RED', tagline: '새 소개' })
        .expect(200);
      expect(res.body.site).toMatchObject({ color: 'RED', tagline: '새 소개', status: 'ACTIVE' });
      const pub = await t.http().get('/api/v1/sites/gangnam').expect(200);
      expect(pub.body).toMatchObject({ color: 'RED', tagline: '새 소개' });
      const audit = await t.prisma.auditLog.findFirst({ where: { action: 'agency_site.update' } });
      expect(audit?.after).toMatchObject({ color: 'RED', tagline: '새 소개' });
    });

    it('404 without a site, 400 for an empty body, 403 for staff', async () => {
      const { agency, s } = await office();
      const none = await withSession(t.http().patch('/api/v1/agencies/mine/site'), s)
        .send({ color: 'RED' })
        .expect(404);
      expect(none.body.code).toBe(ErrorCode.AGENCY_SITE_NOT_FOUND);
      await createAgencySite(t.prisma, agency.id);
      await withSession(t.http().patch('/api/v1/agencies/mine/site'), s).send({}).expect(400);
      const staff = await staffOf(agency);
      await withSession(t.http().patch('/api/v1/agencies/mine/site'), staff)
        .send({ color: 'RED' })
        .expect(403);
    });
  });

  // ---------- public ----------

  describe('GET /api/v1/sites/:slug', () => {
    it('200: the servable site with the office profile (which links back to the site)', async () => {
      const { agency } = await office({ name: '강남공인중개사사무소' });
      await createAgencySite(t.prisma, agency.id, { slug: 'gangnam', color: 'TEAL' });
      const res = await t.http().get('/api/v1/sites/GANGNAM').expect(200);
      expect(res.body).toMatchObject({
        slug: 'gangnam',
        color: 'TEAL',
        url: SITE_HOST('gangnam'),
        agency: {
          id: agency.id,
          name: '강남공인중개사사무소',
          site: { url: SITE_HOST('gangnam') },
        },
      });
      const profile = await t.http().get(`/api/v1/agencies/${agency.id}`).expect(200);
      expect(profile.body.site).toEqual({ url: SITE_HOST('gangnam') });
    });

    it('404 unless ACTIVE and the office is APPROVED (profile links nothing then)', async () => {
      const a = await office();
      await createAgencySite(t.prisma, a.agency.id, {
        slug: 'suspended-one',
        status: AgencySiteStatus.SUSPENDED,
      });
      const b = await office();
      await createAgencySite(t.prisma, b.agency.id, {
        status: AgencySiteStatus.REQUESTED,
        requestedSlug: 'pending-one',
      });
      const c = await office({ status: AgencyStatus.SUSPENDED });
      await createAgencySite(t.prisma, c.agency.id, { slug: 'office-off' });
      for (const slug of ['suspended-one', 'pending-one', 'office-off', 'nobody-here']) {
        const res = await t.http().get(`/api/v1/sites/${slug}`).expect(404);
        expect(res.body.code).toBe(ErrorCode.AGENCY_SITE_NOT_FOUND);
      }
      expect(
        (await t.http().get(`/api/v1/agencies/${a.agency.id}`).expect(200)).body.site,
      ).toBeNull();
    });

    it('400 for reserved or malformed slugs', async () => {
      for (const slug of ['admin', 'a_b', 'ab']) {
        const res = await t.http().get(`/api/v1/sites/${slug}`).expect(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      }
    });

    it('FEATURES.siteSubscriptionRequired gates the site on an ACTIVE SITE 이용권', async () => {
      const { agency, s } = await office();
      await createAgencySite(t.prisma, agency.id, { slug: 'gangnam' });
      await t.http().get('/api/v1/sites/gangnam').expect(200);
      const settings = await admin(AdminRole.ADMIN);
      await withSession(t.http().put('/api/v1/admin/site-settings/FEATURES'), settings)
        .send({ siteSubscriptionRequired: true, platformSubscriptionRequired: false })
        .expect(200);
      // The admin write bumped the cached site and profile.
      await t.http().get('/api/v1/sites/gangnam').expect(404);
      expect(
        (await t.http().get(`/api/v1/agencies/${agency.id}`).expect(200)).body.site,
      ).toBeNull();
      const mine = await withSession(t.http().get('/api/v1/agencies/mine/site'), s).expect(200);
      expect(mine.body.subscription).toEqual({ required: true, active: false, endsOn: null });
      expect(mine.body.site.live).toBe(false);

      // An ended or canceled period does not count; one covering today does.
      await createSubscription(t.prisma, agency.id, {
        startsOn: '2020-01-01',
        endsOn: '2020-12-31',
      });
      await createSubscription(t.prisma, agency.id, {
        startsOn: today(),
        endsOn: null,
        canceledAt: new Date(),
      });
      await createSubscription(t.prisma, agency.id, {
        product: SubscriptionProduct.PLATFORM,
        startsOn: today(),
      });
      await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/subscriptions`),
        settings,
      )
        .send({ product: 'SITE', startsOn: today(), endsOn: '2099-12-31', amountWon: 50000 })
        .expect(201);
      await t.http().get('/api/v1/sites/gangnam').expect(200);
      const after = await withSession(t.http().get('/api/v1/agencies/mine/site'), s).expect(200);
      expect(after.body.subscription).toEqual({
        required: true,
        active: true,
        endsOn: '2099-12-31',
      });
      expect(after.body.site.live).toBe(true);
    });
  });

  // ---------- admin ----------

  describe('GET /api/v1/admin/agency-sites', () => {
    it('200: REQUESTED oldest first, with the office; q matches office name or slug', async () => {
      const a = await createAgency(t.prisma, { name: '첫째공인중개사' });
      const b = await createAgency(t.prisma, { name: '둘째공인중개사' });
      const c = await createAgency(t.prisma, { name: '셋째공인중개사' });
      await createAgencySite(t.prisma, b.agency.id, {
        status: AgencySiteStatus.REQUESTED,
        requestedSlug: 'second',
        requestedAt: new Date('2026-11-02T00:00:00Z'),
      });
      await createAgencySite(t.prisma, a.agency.id, {
        status: AgencySiteStatus.REQUESTED,
        requestedSlug: 'first',
        requestedAt: new Date('2026-11-01T00:00:00Z'),
      });
      await createAgencySite(t.prisma, c.agency.id, { slug: 'third' });
      const s = await admin();
      const res = await withSession(
        t.http().get('/api/v1/admin/agency-sites?status=REQUESTED'),
        s,
      ).expect(200);
      expect(res.body.total).toBe(2);
      expect(pluck(pluck(res.body.items, 'site'), 'requestedSlug')).toEqual(['first', 'second']);
      expect(res.body.items[0].agency).toEqual({
        id: a.agency.id,
        name: '첫째공인중개사',
        representativeName: a.agency.representativeName,
        status: 'APPROVED',
      });
      const byName = await withSession(
        t.http().get(`/api/v1/admin/agency-sites?q=${encodeURIComponent('셋째')}`),
        s,
      ).expect(200);
      expect(pluck(pluck(byName.body.items, 'agency'), 'id')).toEqual([c.agency.id]);
      const bySlug = await withSession(
        t.http().get('/api/v1/admin/agency-sites?q=SECOND'),
        s,
      ).expect(200);
      expect(bySlug.body.total).toBe(1);
      const all = await withSession(t.http().get('/api/v1/admin/agency-sites'), s).expect(200);
      expect(all.body.total).toBe(3);
    });

    it('decided tabs: most recently decided first, unmoved by an owner’s colour edit', async () => {
      const older = await office();
      const newer = await office();
      await createAgencySite(t.prisma, older.agency.id, {
        slug: 'older-one',
        decidedAt: new Date('2026-06-01T00:00:00Z'),
      });
      await createAgencySite(t.prisma, newer.agency.id, {
        slug: 'newer-one',
        decidedAt: new Date('2026-11-01T00:00:00Z'),
      });
      // The office decided months ago changes its brand colour (bumps updatedAt).
      await withSession(t.http().patch('/api/v1/agencies/mine/site'), older.s)
        .send({ color: 'NAVY' })
        .expect(200);
      const s = await admin();
      const res = await withSession(
        t.http().get('/api/v1/admin/agency-sites?status=ACTIVE'),
        s,
      ).expect(200);
      expect(pluck(pluck(res.body.items, 'site'), 'slug')).toEqual(['newer-one', 'older-one']);
    });

    it('401 for user sessions, 400 for an unknown status', async () => {
      const { s: user } = await office();
      await withSession(t.http().get('/api/v1/admin/agency-sites'), user).expect(401);
      const s = await admin();
      await withSession(t.http().get('/api/v1/admin/agency-sites?status=OPEN'), s).expect(400);
    });
  });

  describe('GET /api/v1/admin/agencies/:id/site', () => {
    it('200 with the site or null; 404 unknown office; 400 bad id; 401 anonymous', async () => {
      const s = await admin();
      const { agency } = await createAgency(t.prisma);
      expect(
        (await withSession(t.http().get(`/api/v1/admin/agencies/${agency.id}/site`), s).expect(200))
          .body,
      ).toEqual({ site: null });
      await createAgencySite(t.prisma, agency.id, { slug: 'gangnam' });
      const res = await withSession(
        t.http().get(`/api/v1/admin/agencies/${agency.id}/site`),
        s,
      ).expect(200);
      expect(res.body.site).toMatchObject({ slug: 'gangnam', status: 'ACTIVE', live: true });
      await withSession(
        t.http().get('/api/v1/admin/agencies/0190a0a0-0000-7000-8000-000000000000/site'),
        s,
      ).expect(404);
      await withSession(t.http().get('/api/v1/admin/agencies/nope/site'), s).expect(400);
      await t.http().get(`/api/v1/admin/agencies/${agency.id}/site`).expect(401);
    });
  });

  describe('POST /api/v1/admin/agencies/:id/site/decision', () => {
    async function requested(slug = 'gangnam'): Promise<{ agency: Agency; owner: User }> {
      const o = await createAgency(t.prisma, { name: '강남공인중개사사무소' });
      await createAgencySite(t.prisma, o.agency.id, {
        status: AgencySiteStatus.REQUESTED,
        requestedSlug: slug,
      });
      return o;
    }
    const decide = (s: TestSession, agencyId: string, body: object) =>
      withSession(t.http().post(`/api/v1/admin/agencies/${agencyId}/site/decision`), s).send(body);

    it('APPROVE with an edited slug: ACTIVE, owner notified, audited, https reset, public', async () => {
      const { agency, owner } = await requested('gangnam');
      const s = await admin();
      const res = await decide(s, agency.id, { action: 'APPROVE', slug: 'Gangnam-Best' }).expect(
        200,
      );
      expect(res.body.site).toMatchObject({
        status: 'ACTIVE',
        slug: 'gangnam-best',
        requestedSlug: 'gangnam',
        url: SITE_HOST('gangnam-best'),
        decisionReason: null,
      });
      const row = await t.prisma.agencySite.findUniqueOrThrow({ where: { agencyId: agency.id } });
      expect(row.httpsReadyAt).toBeNull();
      expect(row.decidedByAdminId).not.toBeNull();
      const note = await t.prisma.notification.findFirstOrThrow({ where: { userId: owner.id } });
      expect(note).toMatchObject({
        type: NotificationType.AGENCY_SITE_APPROVED,
        // The host's certificate comes with the next sites.sh run: no claim it is open now.
        body: `홈페이지 주소: ${SITE_HOST('gangnam-best')} (주소는 보통 10분 안에 열려요)`,
      });
      expect(note.data).toMatchObject({ agencyId: agency.id, slug: 'gangnam-best' });
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'agency_site.approve' },
      });
      expect(audit).toMatchObject({
        actorType: 'ADMIN',
        resourceType: 'AgencySite',
        resourceId: row.id,
      });
      await t.http().get('/api/v1/sites/gangnam-best').expect(200);
    });

    it('REJECT needs a reason and notifies; SUSPEND / RESUME need ADMIN and notify nobody', async () => {
      const { agency, owner } = await requested();
      const op = await admin();
      const noReason = await decide(op, agency.id, { action: 'REJECT' }).expect(400);
      expect(noReason.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      const rejected = await decide(op, agency.id, {
        action: 'REJECT',
        reason: '상호와 무관한 주소',
      }).expect(200);
      expect(rejected.body.site).toMatchObject({
        status: 'REJECTED',
        decisionReason: '상호와 무관한 주소',
      });
      const note = await t.prisma.notification.findFirstOrThrow({ where: { userId: owner.id } });
      expect(note).toMatchObject({
        type: NotificationType.AGENCY_SITE_REJECTED,
        body: '상호와 무관한 주소',
      });

      const live = await createAgency(t.prisma);
      await createAgencySite(t.prisma, live.agency.id, { slug: 'live-one' });
      const forbidden = await decide(op, live.agency.id, {
        action: 'SUSPEND',
        reason: '허위 광고',
      }).expect(403);
      expect(forbidden.body.code).toBe(ErrorCode.AGENCY_DECISION_FORBIDDEN);
      const boss = await admin(AdminRole.ADMIN);
      await decide(boss, live.agency.id, { action: 'SUSPEND', reason: '허위 광고' }).expect(200);
      await t.http().get('/api/v1/sites/live-one').expect(404);
      const resumed = await decide(boss, live.agency.id, { action: 'RESUME' }).expect(200);
      expect(resumed.body.site).toMatchObject({
        status: 'ACTIVE',
        slug: 'live-one',
        decisionReason: null,
      });
      await t.http().get('/api/v1/sites/live-one').expect(200);
      expect(await t.prisma.notification.count({ where: { userId: live.owner.id } })).toBe(0);
      expect(
        pluck(
          await t.prisma.auditLog.findMany({
            where: { resourceType: 'AgencySite' },
            orderBy: { createdAt: 'asc' },
          }),
          'action',
        ),
      ).toEqual(['agency_site.reject', 'agency_site.suspend', 'agency_site.resume']);
    });

    it('409 for a taken slug or a wrong transition; 404 without a site; 400 slug on REJECT', async () => {
      const other = await createAgency(t.prisma);
      await createAgencySite(t.prisma, other.agency.id, { slug: 'taken-live' });
      const { agency } = await requested('taken-live');
      const s = await admin();
      const dup = await decide(s, agency.id, { action: 'APPROVE' }).expect(409);
      expect(dup.body.code).toBe(ErrorCode.AGENCY_SITE_SLUG_DUPLICATE);
      const wrong = await decide(s, agency.id, { action: 'RESUME' });
      // RESUME is ADMIN work: an OPERATOR is refused before the transition is checked.
      expect(wrong.status).toBe(403);
      const boss = await admin(AdminRole.ADMIN);
      const transition = await decide(boss, agency.id, {
        action: 'SUSPEND',
        reason: '사유',
      }).expect(409);
      expect(transition.body.code).toBe(ErrorCode.AGENCY_SITE_INVALID_TRANSITION);
      await decide(s, agency.id, { action: 'REJECT', reason: '사유', slug: 'x-y-z' }).expect(400);
      await decide(s, agency.id, { action: 'APPROVE', slug: 'www' }).expect(400);
      const bare = await createAgency(t.prisma);
      const none = await decide(s, bare.agency.id, { action: 'APPROVE' }).expect(404);
      expect(none.body.code).toBe(ErrorCode.AGENCY_SITE_NOT_FOUND);
    });

    it('401 for user sessions; the public site origin is refused (CSRF)', async () => {
      const { agency } = await requested();
      const { s: user } = await office();
      await withSession(t.http().post(`/api/v1/admin/agencies/${agency.id}/site/decision`), user)
        .send({ action: 'APPROVE' })
        .expect(401);
      const s = await admin();
      const res = await decide(s, agency.id, { action: 'APPROVE' })
        .set('Origin', SITE_HOST('gangnam'))
        .expect(403);
      expect(res.body.code).toBe(ErrorCode.CSRF_FAILED);
    });
  });

  describe('admin 이용권 (subscriptions)', () => {
    it('GET: newest first with per-product current flags; 404 unknown office; 401', async () => {
      const { agency } = await createAgency(t.prisma);
      await createSubscription(t.prisma, agency.id, {
        startsOn: '2020-01-01',
        endsOn: '2020-12-31',
      });
      await createSubscription(t.prisma, agency.id, {
        product: SubscriptionProduct.PLATFORM,
        startsOn: today(),
        endsOn: null,
      });
      const s = await admin();
      const res = await withSession(
        t.http().get(`/api/v1/admin/agencies/${agency.id}/subscriptions`),
        s,
      ).expect(200);
      expect(res.body.current).toEqual({ SITE: false, PLATFORM: true });
      expect(pluck(res.body.items, 'state')).toEqual(['ACTIVE', 'ENDED']);
      await withSession(
        t.http().get('/api/v1/admin/agencies/0190a0a0-0000-7000-8000-000000000000/subscriptions'),
        s,
      ).expect(404);
      await t.http().get(`/api/v1/admin/agencies/${agency.id}/subscriptions`).expect(401);
    });

    it('POST (ADMIN+): records a period, audited; 403 OPERATOR; 400 bad period', async () => {
      const { agency } = await createAgency(t.prisma);
      const boss = await admin(AdminRole.ADMIN);
      const res = await withSession(
        t.http().post(`/api/v1/admin/agencies/${agency.id}/subscriptions`),
        boss,
      )
        .send({
          product: 'SITE',
          startsOn: '2026-12-01',
          endsOn: '2026-12-31',
          amountWon: 30000,
          memo: '12월분 계좌이체',
        })
        .expect(201);
      expect(res.body).toMatchObject({
        agencyId: agency.id,
        product: 'SITE',
        startsOn: '2026-12-01',
        endsOn: '2026-12-31',
        amountWon: 30000,
        memo: '12월분 계좌이체',
        canceledAt: null,
        createdByName: expect.any(String),
      });
      const audit = await t.prisma.auditLog.findFirstOrThrow({
        where: { action: 'subscription.create' },
      });
      expect(audit).toMatchObject({ resourceType: 'AgencySubscription', resourceId: res.body.id });
      const op = await admin();
      await withSession(t.http().post(`/api/v1/admin/agencies/${agency.id}/subscriptions`), op)
        .send({ product: 'SITE', startsOn: '2026-12-01' })
        .expect(403);
      for (const body of [
        { product: 'SITE', startsOn: '2026-12-01', endsOn: '2026-11-30' },
        { product: 'GOLD', startsOn: '2026-12-01' },
        { product: 'SITE', startsOn: '2026/12/01' },
        { product: 'SITE', startsOn: '2026-12-01', amountWon: -1 },
      ]) {
        await withSession(t.http().post(`/api/v1/admin/agencies/${agency.id}/subscriptions`), boss)
          .send(body)
          .expect(400);
      }
    });

    it('PATCH (ADMIN+): end early, edit memo, cancel; 400 before start; 404; 403 OPERATOR', async () => {
      const { agency } = await createAgency(t.prisma);
      const sub = await createSubscription(t.prisma, agency.id, {
        startsOn: '2026-12-01',
        endsOn: '2027-11-30',
      });
      const boss = await admin(AdminRole.ADMIN);
      const patch = (s: TestSession, id: string, body: object) =>
        withSession(t.http().patch(`/api/v1/admin/subscriptions/${id}`), s).send(body);
      const ended = await patch(boss, sub.id, { endsOn: '2026-12-31', memo: '조기 종료' }).expect(
        200,
      );
      expect(ended.body).toMatchObject({
        endsOn: '2026-12-31',
        memo: '조기 종료',
        canceledAt: null,
      });
      const canceled = await patch(boss, sub.id, { cancel: true }).expect(200);
      expect(canceled.body).toMatchObject({ state: 'CANCELED', canceledAt: expect.any(String) });
      const again = await patch(boss, sub.id, { cancel: true }).expect(200);
      expect(again.body.canceledAt).toBe(canceled.body.canceledAt);
      expect(
        pluck(
          await t.prisma.auditLog.findMany({
            where: { resourceType: 'AgencySubscription' },
            orderBy: { createdAt: 'asc' },
          }),
          'action',
        ),
      ).toEqual(['subscription.update', 'subscription.cancel', 'subscription.cancel']);

      const early = await patch(boss, sub.id, { endsOn: '2026-11-30' }).expect(400);
      expect(early.body.code).toBe(ErrorCode.AGENCY_SUBSCRIPTION_INVALID_PERIOD);
      await patch(boss, sub.id, {}).expect(400);
      const missing = await patch(boss, '0190a0a0-0000-7000-8000-000000000000', {
        cancel: true,
      }).expect(404);
      expect(missing.body.code).toBe(ErrorCode.AGENCY_SUBSCRIPTION_NOT_FOUND);
      await patch(await admin(), sub.id, { memo: 'x' }).expect(403);
    });
  });
});

describe('agencies: 사무소 홈페이지 behind https (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp({
      override: withConfig({
        PUBLIC_BASE_URL: 'https://suncheonmap.kr',
        // install.sh --admin-subdomain manage
        ADMIN_BASE_URL: 'https://manage.suncheonmap.kr',
        SITE_ROOT_DOMAIN: 'suncheonmap.kr',
      }),
    });
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  it('serves the site before its certificate is ready, but links it as live only after', async () => {
    const { agency, owner } = await createAgency(t.prisma);
    await createAgencySite(t.prisma, agency.id, { slug: 'gangnam', httpsReadyAt: null });
    const s = await loginUser(
      t.app,
      { id: owner.id, role: UserRole.AGENCY_OWNER },
      { agencyId: agency.id },
    );
    const site = await t.http().get('/api/v1/sites/gangnam').expect(200);
    expect(site.body.url).toBe('https://gangnam.suncheonmap.kr');
    expect(site.body.agency.site).toBeNull();
    const mine = await withSession(t.http().get('/api/v1/agencies/mine/site'), s).expect(200);
    expect(mine.body).toMatchObject({
      rootDomain: 'suncheonmap.kr',
      site: { url: 'https://gangnam.suncheonmap.kr', httpsReady: false, live: false },
    });
    // deploy/sites.sh marks the host ready; the profile picks it up once its cache turns over.
    await t.prisma.agencySite.update({
      where: { agencyId: agency.id },
      data: { httpsReadyAt: new Date() },
    });
    await t.redis.flushdb();
    const profile = await t.http().get(`/api/v1/agencies/${agency.id}`).expect(200);
    expect(profile.body.site).toEqual({ url: 'https://gangnam.suncheonmap.kr' });
  });

  it('the admin host’s label (a custom --admin-subdomain) is RESERVED: availability, request, approve', async () => {
    const { agency, owner } = await createAgency(t.prisma);
    const s = {
      ...(await loginUser(
        t.app,
        { id: owner.id, role: UserRole.AGENCY_OWNER },
        { agencyId: agency.id },
      )),
      origin: 'https://suncheonmap.kr',
    };
    const check = await withSession(
      t.http().get('/api/v1/agencies/mine/site/availability?slug=manage'),
      s,
    ).expect(200);
    expect(check.body).toEqual({ slug: 'manage', available: false, reason: 'RESERVED' });
    const req = await withSession(t.http().post('/api/v1/agencies/mine/site'), s)
      .send({ slug: 'manage' })
      .expect(400);
    expect(req.body.code).toBe(ErrorCode.AGENCY_SITE_SLUG_RESERVED);

    await createAgencySite(t.prisma, agency.id, {
      status: AgencySiteStatus.REQUESTED,
      requestedSlug: 'manage',
    });
    const a = await createAdmin(t.prisma, { role: AdminRole.OPERATOR });
    const admin = {
      ...(await loginAdmin(t.app, { id: a.id, role: AdminRole.OPERATOR })),
      origin: 'https://manage.suncheonmap.kr',
    };
    const approve = await withSession(
      t.http().post(`/api/v1/admin/agencies/${agency.id}/site/decision`),
      admin,
    )
      .send({ action: 'APPROVE' })
      .expect(400);
    expect(approve.body.code).toBe(ErrorCode.AGENCY_SITE_SLUG_RESERVED);
    expect(
      (await t.prisma.agencySite.findUniqueOrThrow({ where: { agencyId: agency.id } })).status,
    ).toBe(AgencySiteStatus.REQUESTED);
  });

  it('SUSPEND / RESUME keep the certificate readiness: only a changed slug resets it', async () => {
    const { agency } = await createAgency(t.prisma);
    const ready = new Date('2026-11-20T00:00:00Z');
    await createAgencySite(t.prisma, agency.id, { slug: 'gangnam', httpsReadyAt: ready });
    const a = await createAdmin(t.prisma, { role: AdminRole.ADMIN });
    const admin = {
      ...(await loginAdmin(t.app, { id: a.id, role: AdminRole.ADMIN })),
      origin: 'https://manage.suncheonmap.kr',
    };
    const decide = (body: object) =>
      withSession(t.http().post(`/api/v1/admin/agencies/${agency.id}/site/decision`), admin)
        .send(body)
        .expect(200);
    const suspended = await decide({ action: 'SUSPEND', reason: '허위 광고' });
    expect(suspended.body.site).toMatchObject({ status: 'SUSPENDED', httpsReady: true });
    const resumed = await decide({ action: 'RESUME' });
    expect(resumed.body.site).toMatchObject({ status: 'ACTIVE', httpsReady: true, live: true });
    const row = await t.prisma.agencySite.findUniqueOrThrow({ where: { agencyId: agency.id } });
    expect(row.httpsReadyAt).toEqual(ready);
  });
});
