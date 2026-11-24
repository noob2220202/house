import { AgencyMemberRole, AgencyStatus, ListingStatus, TermsType, UserRole } from '@house/shared';
import { AgencyCacheService } from '../../../src/modules/agencies/services/agency-cache.service';
import { AgencyDashboardService } from '../../../src/modules/agencies/services/agency-dashboard.service';
import {
  actionConsents,
  createActionConsentTerms,
  createAgency,
  createListing,
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import { createAgent, createPendingAgency } from './helpers';

describe('agencies: console additions (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    await createActionConsentTerms(t.prisma);
  });
  afterAll(() => t?.close());

  describe('GET /api/v1/agencies/regions', () => {
    async function regions() {
      await t.prisma.region.create({
        data: {
          code: '12150',
          name: '순천시',
          fullName: '전남광주통합특별시 순천시',
          level: 'SGG',
        },
      });
      await t.prisma.region.create({
        data: {
          code: '12150127',
          name: '조례동',
          fullName: '전남광주통합특별시 순천시 조례동',
          level: 'EMD',
          parentCode: '12150',
          lat: 34.957,
          lng: 127.525,
        },
      });
      // 읍면 stored as a 10-digit "…00" code; 리 rows roll up to it.
      await t.prisma.region.create({
        data: {
          code: '1215036000',
          name: '해룡면',
          fullName: '전남광주통합특별시 순천시 해룡면',
          level: 'EMD',
          parentCode: '12150',
        },
      });
    }

    it('200: 읍면동 facet of APPROVED offices, busiest first, public and cached', async () => {
      await regions();
      await createAgency(t.prisma, { emdCode: '1215012700' });
      await createAgency(t.prisma, { emdCode: '12150127' });
      const h1 = await createAgency(t.prisma, { emdCode: '1215036022', lat: 34.93, lng: 127.55 });
      await createAgency(t.prisma, { emdCode: null }); // counted in total only
      await createAgency(t.prisma, { emdCode: '1215099900' }); // unknown 읍면동: not listed
      await createAgency(t.prisma, { emdCode: '1215012700', status: AgencyStatus.PENDING });
      await createAgency(t.prisma, { emdCode: '1215012700', deletedAt: new Date() });

      const res = await t.http().get('/api/v1/agencies/regions').expect(200);
      expect(res.body).toEqual({
        total: 5,
        items: [
          { emdCode: '12150127', name: '조례동', count: 2, lat: 34.957, lng: 127.525 },
          // No centroid in regions → the offices' mean position.
          { emdCode: '12150360', name: '해룡면', count: 1, lat: 34.93, lng: 127.55 },
        ],
      });

      // Cached until the public agency version is bumped.
      await t.prisma.agency.update({
        where: { id: h1.agency.id },
        data: { status: AgencyStatus.SUSPENDED },
      });
      const cached = await t.http().get('/api/v1/agencies/regions').expect(200);
      expect(cached.body.total).toBe(5);
      await t.app.get(AgencyCacheService).invalidatePublic();
      const fresh = await t.http().get('/api/v1/agencies/regions').expect(200);
      expect(fresh.body.total).toBe(4);
      expect(fresh.body.items).toHaveLength(1);
    });

    it('200: empty facet without offices; `regions` is not taken as an agency id', async () => {
      const res = await t.http().get('/api/v1/agencies/regions').expect(200);
      expect(res.body).toEqual({ total: 0, items: [] });
    });
  });

  describe('GET /api/v1/agencies/mine (B2: staff)', () => {
    it('owner: full view with myRole OWNER', async () => {
      const { agency, owner } = await createAgency(t.prisma, { businessNumber: '2208162517' });
      const s = await loginUser(t.app, owner, { agencyId: agency.id });
      const res = await withSession(t.http().get('/api/v1/agencies/mine'), s).expect(200);
      expect(res.body).toMatchObject({
        id: agency.id,
        myRole: AgencyMemberRole.OWNER,
        businessNumber: '2208162517',
      });
    });

    it('AGENT: reduced view of the agency they work for (no documents / history / 사업자번호)', async () => {
      const { agency, owner } = await createPendingAgency(t.prisma, {
        status: AgencyStatus.APPROVED,
        approvedAt: new Date(),
      });
      await t.prisma.agencyStatusHistory.create({
        data: { agencyId: agency.id, fromStatus: null, toStatus: AgencyStatus.PENDING },
      });
      await t.prisma.user.update({
        where: { id: owner.id },
        data: { role: UserRole.AGENCY_OWNER },
      });
      const { user } = await createAgent(t.prisma, agency.id);
      const s = await loginUser(
        t.app,
        { id: user.id, role: UserRole.AGENT },
        { agencyId: agency.id },
      );
      const res = await withSession(t.http().get('/api/v1/agencies/mine'), s).expect(200);
      expect(res.body).toMatchObject({
        id: agency.id,
        name: agency.name,
        status: AgencyStatus.APPROVED,
        myRole: AgencyMemberRole.AGENT,
        businessNumber: null,
        documents: [],
        statusHistory: [],
      });
      expect(res.body.memberCount).toBe(2);
      // Owner-only writes stay owner-only.
      await withSession(t.http().get('/api/v1/agencies/mine/members'), s).expect(403);
    });

    it('404 for removed staff and users without any agency', async () => {
      const { agency } = await createAgency(t.prisma);
      const { user, memberId } = await createAgent(t.prisma, agency.id);
      await t.prisma.agencyMember.update({
        where: { id: memberId },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
      const s = await loginUser(t.app, { id: user.id, role: UserRole.USER });
      await withSession(t.http().get('/api/v1/agencies/mine'), s).expect(404);
      const stranger = await loginUser(t.app, await createUser(t.prisma));
      const res = await withSession(t.http().get('/api/v1/agencies/mine'), stranger).expect(404);
      expect(res.body.code).toBe('AGENCY_NOT_FOUND');
    });
  });

  describe('POST /api/v1/agencies/mine/resubmit (D8 consents)', () => {
    it('200: records the 개인정보 수집·이용 동의 when the body carries it', async () => {
      const { owner } = await createPendingAgency(t.prisma, { status: AgencyStatus.REJECTED });
      const s = await loginUser(t.app, owner);
      await withSession(t.http().post('/api/v1/agencies/mine/resubmit'), s)
        .send({ message: '보완했습니다.', consents: actionConsents('AGENCY_APPLICATION') })
        .expect(200);
      const rows = await t.prisma.userConsent.findMany({
        where: { userId: owner.id },
        select: { agreed: true, termsDocument: { select: { type: true, version: true } } },
      });
      expect(rows).toEqual([
        {
          agreed: true,
          termsDocument: { type: TermsType.PRIVACY_AGENCY_APPLICATION, version: '1.0' },
        },
      ]);
    });

    it('4xx for an outdated version (nothing changes); 200 without consents (none recorded)', async () => {
      const { agency, owner } = await createPendingAgency(t.prisma, {
        status: AgencyStatus.REJECTED,
      });
      const s = await loginUser(t.app, owner);
      const bad = await withSession(t.http().post('/api/v1/agencies/mine/resubmit'), s)
        .send({ consents: actionConsents('AGENCY_APPLICATION', '0.9') })
        .expect((r) => expect(r.status).toBeGreaterThanOrEqual(400));
      expect(bad.body.code).toBe('AUTH_CONSENT_OUTDATED');
      const row = await t.prisma.agency.findUniqueOrThrow({ where: { id: agency.id } });
      expect(row.status).toBe(AgencyStatus.REJECTED);
      await withSession(t.http().post('/api/v1/agencies/mine/resubmit'), s).send({}).expect(200);
      expect(await t.prisma.userConsent.count({ where: { userId: owner.id } })).toBe(0);
      // Unknown consent types are rejected by validation.
      await withSession(t.http().post('/api/v1/agencies/mine/resubmit'), s)
        .send({ consents: [{ type: 'MARKETING', version: '1.0' }] })
        .expect(400);
    });
  });

  describe('AgencyDashboardService.snapshot (daily views job)', () => {
    it('upserts today’s cumulative listing views per approved agency, idempotently', async () => {
      const { agency } = await createAgency(t.prisma);
      const pending = await createAgency(t.prisma, { status: AgencyStatus.PENDING });
      const { listing } = await createListing(t.prisma, {
        agencyId: agency.id,
        listing: { viewCount: 40 },
      });
      await createListing(t.prisma, {
        agencyId: agency.id,
        listing: { viewCount: 2, status: ListingStatus.CLOSED },
      });
      await createListing(t.prisma, {
        agencyId: agency.id,
        listing: { viewCount: 1000, deletedAt: new Date() },
      });
      const svc = t.app.get(AgencyDashboardService);
      const now = new Date('2026-11-24T03:00:00Z');
      expect(await svc.snapshot(now)).toBe(1);
      await t.prisma.listing.update({ where: { id: listing.id }, data: { viewCount: 45 } });
      await svc.snapshot(now);
      const rows = await t.prisma.agencyDailyStat.findMany();
      expect(rows).toEqual([
        expect.objectContaining({
          agencyId: agency.id,
          day: new Date('2026-11-24T00:00:00Z'),
          listingViews: 47,
        }),
      ]);
      expect(rows.some((r) => r.agencyId === pending.agency.id)).toBe(false);
    });
  });
});
