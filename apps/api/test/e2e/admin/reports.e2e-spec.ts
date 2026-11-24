import {
  AdminRole,
  AgencyStatus,
  ErrorCode,
  ListingStatus,
  NotificationType,
  ReportAction,
  ReportReason,
  ReportStatus,
  ReportTargetType,
} from '@house/shared';
import { kstDateKey } from '../../../src/common/throttle/daily-cap.service';
import { REPORT_CONTACT_RETENTION_DAYS } from '../../../src/modules/admin/constants';
import { ReportsService } from '../../../src/modules/admin/services/reports.service';
import {
  createAgency,
  createListing,
  createUser,
  loginUser,
  resetAll,
  type TestApp,
  type TestSession,
  withSession,
  createTestApp,
} from '../../utils';
import { adminActor, api, as, auditRows, expectAdminAuthz, expectCode } from './helpers';

describe('reports (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function fixture() {
    const { agency, owner } = await createAgency(t.prisma);
    const { listing } = await createListing(t.prisma, { agencyId: agency.id });
    const reporter = await createUser(t.prisma);
    const session = await loginUser(t.app, reporter);
    return { agency, owner, listing, reporter, session };
  }

  function report(session: TestSession, body: object) {
    return withSession(t.http().post(api('/reports')), session).send(body);
  }

  describe('POST /reports', () => {
    it('creates a report on a public listing and links its primary agency', async () => {
      const { listing, agency, reporter, session } = await fixture();
      const res = await report(session, {
        targetType: ReportTargetType.LISTING,
        targetId: listing.id,
        reason: ReportReason.ALREADY_DEALT,
        detail: '이미 계약된 매물입니다.',
        reporterPhone: '010-1234-5678',
      }).expect(201);
      expect(res.body).toMatchObject({ status: ReportStatus.RECEIVED });
      const row = await t.prisma.report.findUniqueOrThrow({ where: { id: res.body.id } });
      expect(row).toMatchObject({
        listingId: listing.id,
        agencyId: agency.id,
        reporterUserId: reporter.id,
        reporterPhone: '01012345678',
      });
    });

    it('reports an approved agency', async () => {
      const { agency, session } = await fixture();
      await report(session, {
        targetType: ReportTargetType.AGENCY,
        targetId: agency.id,
        reason: ReportReason.UNREACHABLE,
      }).expect(201);
    });

    it('rejects a second open report on the same target (409)', async () => {
      const { listing, session } = await fixture();
      const body = { targetType: 'LISTING', targetId: listing.id, reason: 'WRONG_PRICE' };
      await report(session, body).expect(201);
      expectCode(await report(session, body).expect(409), ErrorCode.REPORT_DUPLICATE);
    });

    it('404s for listings the public cannot see', async () => {
      const { agency, session } = await fixture();
      const { listing } = await createListing(t.prisma, {
        agencyId: agency.id,
        listing: { status: ListingStatus.HIDDEN },
      });
      const pending = await createAgency(t.prisma, { status: AgencyStatus.PENDING });
      const res = await report(session, {
        targetType: 'LISTING',
        targetId: listing.id,
        reason: 'NOT_EXIST',
      }).expect(404);
      expectCode(res, ErrorCode.REPORT_TARGET_NOT_FOUND);
      await report(session, {
        targetType: 'AGENCY',
        targetId: pending.agency.id,
        reason: 'NOT_EXIST',
      }).expect(404);
    });

    it('requires a logged-in user (401) — admin cookies do not count', async () => {
      const { listing } = await fixture();
      const body = { targetType: 'LISTING', targetId: listing.id, reason: 'NOT_EXIST' };
      await t.http().post(api('/reports')).send(body).expect(401);
      const { session } = await adminActor(t);
      await withSession(t.http().post(api('/reports')), session)
        .send(body)
        .expect(401);
    });

    it('validates the body (400)', async () => {
      const { listing, session } = await fixture();
      const res = await report(session, {
        targetType: 'LISTING',
        targetId: listing.id,
        reason: 'OTHER',
      }).expect(400);
      expectCode(res, ErrorCode.VALIDATION_FAILED);
      await report(session, {
        targetType: 'LISTING',
        targetId: 'nope',
        reason: 'NOT_EXIST',
      }).expect(400);
      await report(session, {
        targetType: 'LISTING',
        targetId: listing.id,
        reason: 'NOT_EXIST',
        reporterPhone: '02-123',
      }).expect(400);
    });

    it('enforces the per-user daily cap (429)', async () => {
      const { listing, reporter, session } = await fixture();
      await t.redis.set(`cap:REPORT_CREATE:${kstDateKey()}:${reporter.id}`, '10');
      const res = await report(session, {
        targetType: 'LISTING',
        targetId: listing.id,
        reason: 'NOT_EXIST',
      }).expect(429);
      expectCode(res, ErrorCode.RATE_LIMITED);
    });
  });

  describe('admin queue', () => {
    async function openReport(
      targetType: ReportTargetType = ReportTargetType.LISTING,
      extra: { reporterPhone?: string } = {},
    ) {
      const f = await fixture();
      const res = await report(f.session, {
        targetType,
        targetId: targetType === ReportTargetType.LISTING ? f.listing.id : f.agency.id,
        reason: ReportReason.NOT_EXIST,
        ...extra,
      }).expect(201);
      return { ...f, reportId: res.body.id as string };
    }

    it('GET /admin/reports lists and filters (operator)', async () => {
      const { reportId, listing } = await openReport();
      await openReport(ReportTargetType.AGENCY);
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const all = await as(t, session, 'get', '/admin/reports').expect(200);
      expect(all.body.total).toBe(2);
      const filtered = await as(
        t,
        session,
        'get',
        `/admin/reports?targetType=LISTING&status=RECEIVED&listingId=${listing.id}`,
      ).expect(200);
      expect(filtered.body.items).toHaveLength(1);
      expect(filtered.body.items[0]).toMatchObject({
        id: reportId,
        listing: { id: listing.id, status: ListingStatus.ACTIVE },
        reporter: { id: expect.any(String) },
      });
    });

    it('GET /admin/reports authz + validation', async () => {
      const { session } = await fixture();
      await expectAdminAuthz(t, 'get', '/admin/reports', { userSession: session });
      const admin = await adminActor(t, AdminRole.OPERATOR);
      await as(t, admin.session, 'get', '/admin/reports?status=NOPE').expect(400);
    });

    it('GET /admin/reports/:id detail, 404, 400, authz', async () => {
      const { reportId, session: userSession } = await openReport();
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'get', `/admin/reports/${reportId}`).expect(200);
      expect(res.body).toMatchObject({ id: reportId, reason: ReportReason.NOT_EXIST });
      // The target card shows the listing's 종류, 거래 형태·가격 and facts without a second call.
      expect(res.body.listing).toMatchObject({
        assetType: expect.any(String),
        dealType: expect.any(String),
        photoCount: expect.any(Number),
      });
      expect(res.body.listing).toHaveProperty('salePrice');
      expect(res.body.listing).toHaveProperty('complexName');
      expect(res.body.listing).toHaveProperty('exclusiveArea');
      expectCode(
        await as(t, session, 'get', '/admin/reports/01890a5d-ac96-774b-bcce-b302099a8057').expect(
          404,
        ),
        ErrorCode.REPORT_NOT_FOUND,
      );
      await as(t, session, 'get', '/admin/reports/not-a-uuid').expect(400);
      await expectAdminAuthz(t, 'get', `/admin/reports/${reportId}`, { userSession });
    });

    it('reporter phone: masked in lists and mutations, full in the detail, which is access-logged', async () => {
      const { reportId } = await openReport(ReportTargetType.LISTING, {
        reporterPhone: '010-1234-5678',
      });
      const { admin, session } = await adminActor(t, AdminRole.OPERATOR);
      const list = await as(t, session, 'get', '/admin/reports').expect(200);
      expect(list.body.items[0].reporterPhone).toBe('010-****-5678');
      expect(await t.prisma.auditLog.count({ where: { action: 'report.pii-view' } })).toBe(0);

      const detail = await as(t, session, 'get', `/admin/reports/${reportId}`).expect(200);
      expect(detail.body.reporterPhone).toBe('01012345678');
      const [view] = await auditRows(t, 'report.pii-view');
      expect(view).toMatchObject({
        adminUserId: admin.id,
        resourceType: 'Report',
        resourceId: reportId,
        actorType: 'ADMIN',
      });
      expect(JSON.stringify(view)).not.toContain('5678');

      const reviewed = await as(t, session, 'patch', `/admin/reports/${reportId}`)
        .send({ status: 'IN_REVIEW' })
        .expect(200);
      expect(reviewed.body.reporterPhone).toBe('010-****-5678');
      await as(t, session, 'post', `/admin/reports/${reportId}/resolve`)
        .send({ status: 'REJECTED' })
        .expect(200);
      const snapshots = await t.prisma.auditLog.findMany({
        where: { action: { in: ['report.review', 'report.resolve'] } },
      });
      expect(snapshots).toHaveLength(2);
      for (const row of snapshots) {
        expect(JSON.stringify([row.before, row.after])).not.toContain('01012345678');
      }
    });

    it('a report without a phone is viewed without an access-log row', async () => {
      const { reportId } = await openReport();
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'get', `/admin/reports/${reportId}`).expect(200);
      expect(res.body.reporterPhone).toBeNull();
      expect(await t.prisma.auditLog.count({ where: { action: 'report.pii-view' } })).toBe(0);
    });

    it('concurrent resolutions: only the winning decision touches the listing', async () => {
      for (let i = 0; i < 4; i++) {
        await resetAll(t);
        const { session: s } = await adminActor(t, AdminRole.OPERATOR);
        const { reportId, listing } = await openReport();
        const resolve = (body: object) =>
          as(t, s, 'post', `/admin/reports/${reportId}/resolve`).send(body);
        // Alternate which request is sent first so either may win.
        const bodies = [
          { status: 'RESOLVED', action: ReportAction.LISTING_HIDDEN },
          { status: 'REJECTED' },
        ];
        if (i % 2 === 1) bodies.reverse();
        const [a, b] = await Promise.all(bodies.map(resolve));
        expect([a?.status, b?.status].sort()).toEqual([200, 409]);
        const row = await t.prisma.report.findUniqueOrThrow({ where: { id: reportId } });
        const after = await t.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
        expect(after.status).toBe(
          row.status === ReportStatus.RESOLVED ? ListingStatus.HIDDEN : ListingStatus.ACTIVE,
        );
        expect(await t.prisma.auditLog.count({ where: { action: 'report.resolve' } })).toBe(1);
      }
    });

    it('erases reporter phone and ip once a closed report is past its retention period', async () => {
      const { listing, agency, reporter } = await fixture();
      const old = new Date(Date.now() - (REPORT_CONTACT_RETENTION_DAYS + 1) * 86_400_000);
      const recent = new Date(Date.now() - 86_400_000);
      const base = {
        targetType: ReportTargetType.LISTING,
        listingId: listing.id,
        agencyId: agency.id,
        reporterUserId: reporter.id,
        reason: ReportReason.NOT_EXIST,
        reporterPhone: '01012345678',
        ip: '203.0.113.7',
      };
      const expired = await t.prisma.report.create({
        data: { ...base, status: ReportStatus.RESOLVED, handledAt: old },
      });
      const fresh = await t.prisma.report.create({
        data: { ...base, status: ReportStatus.REJECTED, handledAt: recent },
      });
      const open = await t.prisma.report.create({
        data: { ...base, status: ReportStatus.IN_REVIEW, handledAt: old },
      });
      const reports = t.app.get(ReportsService);
      expect(await reports.scrubExpiredContacts()).toBe(1);
      expect(await reports.scrubExpiredContacts()).toBe(0);
      const rows = await t.prisma.report.findMany({
        where: { id: { in: [expired.id, fresh.id, open.id] } },
        select: { id: true, reporterPhone: true, ip: true },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get(expired.id)).toMatchObject({ reporterPhone: null, ip: null });
      expect(byId.get(fresh.id)).toMatchObject({ reporterPhone: '01012345678' });
      expect(byId.get(open.id)).toMatchObject({ reporterPhone: '01012345678' });
    });

    it('PATCH /admin/reports/:id takes a report into review (audited)', async () => {
      const { reportId, session: userSession } = await openReport();
      const { admin, session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'patch', `/admin/reports/${reportId}`)
        .send({ status: 'IN_REVIEW', note: '현장 확인 예정' })
        .expect(200);
      expect(res.body).toMatchObject({
        status: ReportStatus.IN_REVIEW,
        resolutionNote: '현장 확인 예정',
        handledBy: { id: admin.id },
      });
      const [audit] = await auditRows(t, 'report.review');
      expect(audit).toMatchObject({ resourceId: reportId, adminUserId: admin.id });
      expect(audit?.before).toMatchObject({ status: ReportStatus.RECEIVED });
      await as(t, session, 'patch', `/admin/reports/${reportId}`).send({}).expect(400);
      await expectAdminAuthz(t, 'patch', `/admin/reports/${reportId}`, {
        userSession,
        body: { status: 'IN_REVIEW' },
      });
    });

    it('POST /admin/reports/:id/resolve hides the listing, warns the agency, notifies', async () => {
      const { reportId, listing, agency, owner, reporter } = await openReport();
      const { admin, session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'post', `/admin/reports/${reportId}/resolve`)
        .send({
          status: 'RESOLVED',
          action: ReportAction.LISTING_HIDDEN_AGENCY_WARNED,
          note: '허위 확인',
        })
        .expect(200);
      expect(res.body).toMatchObject({
        status: ReportStatus.RESOLVED,
        action: ReportAction.LISTING_HIDDEN_AGENCY_WARNED,
        handledBy: { id: admin.id },
        handledAt: expect.any(String),
        listing: { status: ListingStatus.HIDDEN },
        agency: { warningCount: 1 },
      });
      const hidden = await t.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
      expect(hidden.status).toBe(ListingStatus.HIDDEN);
      expect(hidden.hiddenReason).toContain('허위매물');
      const warnings = await t.prisma.agencyWarning.findMany({ where: { agencyId: agency.id } });
      expect(warnings).toEqual([expect.objectContaining({ reportId, adminId: admin.id })]);
      const reporterNotes = await t.prisma.notification.findMany({
        where: { userId: reporter.id },
      });
      expect(reporterNotes.map((n) => n.type)).toEqual([NotificationType.REPORT_RESOLVED]);
      const ownerNotes = await t.prisma.notification.findMany({ where: { userId: owner.id } });
      expect(ownerNotes.map((n) => n.type).sort()).toEqual(
        [NotificationType.AGENCY_WARNED, NotificationType.LISTING_HIDDEN].sort(),
      );
      // Audited exactly once, inside the transaction (the fallback interceptor adds nothing).
      const audits = await t.prisma.auditLog.findMany({ where: { resourceId: reportId } });
      expect(audits.map((a) => a.action)).toEqual(['report.resolve']);
      expect(audits[0]?.before).toMatchObject({ status: ReportStatus.RECEIVED });
      expect(audits[0]?.after).toMatchObject({ status: ReportStatus.RESOLVED });

      const again = await as(t, session, 'post', `/admin/reports/${reportId}/resolve`)
        .send({ status: 'REJECTED' })
        .expect(409);
      expectCode(again, ErrorCode.REPORT_ALREADY_HANDLED);
      await as(t, session, 'patch', `/admin/reports/${reportId}`)
        .send({ status: 'IN_REVIEW' })
        .expect(409);
    });

    it('rejects actions that do not fit the target (400) and validates the body', async () => {
      const { reportId, session: userSession } = await openReport(ReportTargetType.AGENCY);
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'post', `/admin/reports/${reportId}/resolve`)
        .send({ status: 'RESOLVED', action: ReportAction.LISTING_HIDDEN })
        .expect(400);
      expectCode(res, ErrorCode.REPORT_ACTION_INVALID);
      const invalid = await as(t, session, 'post', `/admin/reports/${reportId}/resolve`)
        .send({ status: 'REJECTED', action: ReportAction.AGENCY_WARNED })
        .expect(400);
      expectCode(invalid, ErrorCode.VALIDATION_FAILED);
      await as(t, session, 'post', `/admin/reports/${reportId}/resolve`)
        .send({ status: 'IN_REVIEW' })
        .expect(400);
      // A rejection notifies the reporter and leaves everything else alone.
      await as(t, session, 'post', `/admin/reports/${reportId}/resolve`)
        .send({ status: 'REJECTED', note: '근거 부족' })
        .expect(200);
      expect(await t.prisma.agencyWarning.count()).toBe(0);
      await expectAdminAuthz(t, 'post', `/admin/reports/${reportId}/resolve`, {
        userSession,
        body: { status: 'REJECTED' },
      });
    });
  });
});
