import {
  ADMIN_ROLE_PERMISSIONS,
  AdminRole,
  AgencyStatus,
  AssetType,
  AuditActorType,
  BannerSlot,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  DEFAULT_SGG_CODE,
  ErrorCode,
  ReportReason,
  ReportTargetType,
} from '@house/shared';
import { Controller, Post } from '@nestjs/common';
import { AuditService } from '../../../src/common/audit/audit.service';
import { AppException } from '../../../src/common/errors/app.exception';
import { AdminAuditCoverageService } from '../../../src/modules/admin/audit/admin-audit-coverage.service';
import {
  createAgency,
  createListing,
  createMedia,
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  type TestApp,
  type TestSession,
} from '../../utils';
import { adminActor, api, as, BROWSER_UA, expectAdminAuthz, expectCode, pluck } from './helpers';

/** Admin mutations with no @Audit: the fallback interceptor must cover them. */
@Controller('admin/probe-things')
class AdminProbeController {
  constructor(private readonly audit: AuditService) {}

  @Post()
  create(): { id: string; csrfToken: string; name: string } {
    return { id: 'probe-1', csrfToken: 'secret-token', name: '탐침' };
  }

  @Post('self-audited')
  async selfAudited(): Promise<{ ok: true }> {
    await this.audit.record({ action: 'probe.self', resourceType: 'Probe' });
    return { ok: true };
  }

  @Post('fails')
  fails(): never {
    throw AppException.badRequest();
  }
}

const DAY = 86_400_000;

describe('admin dashboard, visitors, audit log, permissions (e2e)', () => {
  let t: TestApp;
  let userSession: TestSession;

  beforeAll(async () => {
    t = await createTestApp({ controllers: [AdminProbeController] });
  });
  beforeEach(async () => {
    await resetAll(t);
    userSession = await loginUser(t.app, await createUser(t.prisma));
  });
  afterAll(() => t?.close());

  describe('visitor counter', () => {
    it('counts unique visitors per day; skips bots, admin and health routes', async () => {
      const visit = (ua: string, path = '/notices') =>
        t.http().get(api(path)).set('User-Agent', ua).expect(200);
      await visit(BROWSER_UA);
      await visit(BROWSER_UA, '/faqs');
      await visit(`${BROWSER_UA} Edg/130.0`);
      await visit('Googlebot/2.1 (+http://www.google.com/bot.html)');
      await visit(BROWSER_UA, '/health');
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      await as(t, session, 'get', '/admin/permissions')
        .set('User-Agent', 'Other Browser/1.0 (X11)')
        .expect(200);

      const res = await as(t, session, 'get', '/admin/dashboard').expect(200);
      expect(res.body.visitors).toMatchObject({ today: 2, yesterday: 0, uniqueLast7Days: 2 });
      expect(res.body.visitors.last7Days).toHaveLength(7);
    });
  });

  describe('GET /admin/dashboard', () => {
    it('aggregates counters across modules', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      await createAgency(t.prisma, { status: AgencyStatus.PENDING, approvedAt: null });
      const { listing } = await createListing(t.prisma, { agencyId: agency.id });
      await t.prisma.report.create({
        data: {
          targetType: ReportTargetType.LISTING,
          listingId: listing.id,
          agencyId: agency.id,
          reason: ReportReason.NOT_EXIST,
        },
      });
      await t.prisma.dealRequest.create({
        data: {
          type: DealRequestType.WANTED,
          userId: owner.id,
          assetType: AssetType.APT,
          dealTypes: [DealType.JEONSE],
          visibility: DealRequestVisibility.ALL_AGENCIES_IN_REGION,
          sggCode: DEFAULT_SGG_CODE,
          contactName: '구하는사람',
          contactPhone: '01011112222',
        },
      });
      const media = await createMedia(t.prisma, { purpose: 'BANNER' });
      const now = Date.now();
      const ending = await t.prisma.banner.create({
        data: {
          slot: BannerSlot.MAIN_HERO,
          title: '곧 끝나는 배너',
          pcMediaId: media.id,
          startAt: new Date(now - DAY),
          endAt: new Date(now + 2 * DAY),
        },
      });
      await t.prisma.banner.create({
        data: {
          slot: BannerSlot.MAIN_STRIP,
          title: '한참 남은 배너',
          pcMediaId: media.id,
          startAt: new Date(now - DAY),
          endAt: new Date(now + 30 * DAY),
        },
      });

      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'get', '/admin/dashboard').expect(200);
      expect(res.body).toMatchObject({
        listings: { newToday: 1, active: 1, hidden: 0 },
        dealRequests: { newToday: 1, open: 1 },
        agencies: { pending: 1, approved: 1, sitesPending: 0 },
        reports: { open: 1, newToday: 1 },
        ads: { endingSoonCount: 1, endingSoon: [expect.objectContaining({ id: ending.id })] },
      });
      expect(res.body.members.total).toBeGreaterThanOrEqual(3);
      expect(res.headers['cache-control']).toContain('no-store');
    });

    it('authz', async () => {
      await expectAdminAuthz(t, 'get', '/admin/dashboard', { userSession });
    });

    it('validation: unknown query params are ignored, not an error', async () => {
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      await as(t, session, 'get', '/admin/dashboard?foo=bar').expect(200);
    });
  });

  describe('GET /admin/permissions', () => {
    it('returns the permissions of the signed-in role', async () => {
      for (const role of Object.values(AdminRole)) {
        const { admin, session } = await adminActor(t, role);
        const res = await as(t, session, 'get', '/admin/permissions').expect(200);
        expect(res.body).toEqual({
          adminId: admin.id,
          role,
          permissions: [...ADMIN_ROLE_PERMISSIONS[role]],
        });
      }
      await expectAdminAuthz(t, 'get', '/admin/permissions', { userSession });
    });
  });

  describe('audit log viewer', () => {
    it('lists with filters and shows a single entry (ADMIN+)', async () => {
      const { admin, session } = await adminActor(t, AdminRole.ADMIN);
      await as(t, session, 'post', '/admin/notices').send({ title: 'a', content: 'b' }).expect(201);
      const created = await as(t, session, 'post', '/admin/faqs')
        .send({ category: 'GENERAL', question: 'q', answer: 'a' })
        .expect(201);

      const all = await as(t, session, 'get', '/admin/audit-logs').expect(200);
      expect(pluck(all.body.items, 'action')).toEqual(['faq.create', 'notice.create']);
      const byPrefix = await as(t, session, 'get', '/admin/audit-logs?action=faq.').expect(200);
      expect(byPrefix.body.items).toEqual([
        expect.objectContaining({
          action: 'faq.create',
          resourceType: 'Faq',
          resourceId: created.body.id,
          actorType: AuditActorType.ADMIN,
          admin: { id: admin.id, name: admin.name, email: admin.email },
          requestId: expect.any(String),
        }),
      ]);
      const from = new Date(Date.now() + DAY).toISOString();
      expect(
        (
          await as(t, session, 'get', `/admin/audit-logs?from=${encodeURIComponent(from)}`).expect(
            200,
          )
        ).body.total,
      ).toBe(0);
      expect(
        (
          await as(
            t,
            session,
            'get',
            `/admin/audit-logs?adminUserId=${admin.id}&resourceType=Notice&actorType=ADMIN`,
          ).expect(200)
        ).body.total,
      ).toBe(1);

      const id = byPrefix.body.items[0].id as string;
      const one = await as(t, session, 'get', `/admin/audit-logs/${id}`).expect(200);
      expect(one.body.after).toMatchObject({ question: 'q' });
      expectCode(
        await as(
          t,
          session,
          'get',
          '/admin/audit-logs/01890a5d-ac96-774b-bcce-b302099a8057',
        ).expect(404),
        ErrorCode.AUDIT_LOG_NOT_FOUND,
      );
    });

    it('validation failures (400)', async () => {
      const { session } = await adminActor(t, AdminRole.ADMIN);
      await as(t, session, 'get', '/admin/audit-logs?from=yesterday').expect(400);
      await as(t, session, 'get', '/admin/audit-logs?actorType=ROBOT').expect(400);
      await as(
        t,
        session,
        'get',
        `/admin/audit-logs?action=${encodeURIComponent("a' OR 1=1")}`,
      ).expect(400);
      await as(t, session, 'get', '/admin/audit-logs/xyz').expect(400);
    });

    it('authz: ADMIN+ only', async () => {
      await expectAdminAuthz(t, 'get', '/admin/audit-logs', {
        userSession,
        lowRole: AdminRole.OPERATOR,
      });
      await expectAdminAuthz(t, 'get', '/admin/audit-logs/01890a5d-ac96-774b-bcce-b302099a8057', {
        userSession,
        lowRole: AdminRole.OPERATOR,
      });
    });
  });

  describe('admin-wide audit safety net', () => {
    it('audits undecorated admin mutations, strips secrets, never doubles in-service audits', async () => {
      const { admin, session } = await adminActor(t, AdminRole.OPERATOR);
      await as(t, session, 'post', '/admin/probe-things').expect(201);
      const [auto] = await t.prisma.auditLog.findMany({
        where: { action: 'auto:probe-things.create' },
      });
      expect(auto).toMatchObject({
        adminUserId: admin.id,
        resourceType: 'probe-things',
        resourceId: 'probe-1',
      });
      expect(auto?.after).toMatchObject({ response: { csrfToken: '[redacted]', name: '탐침' } });

      await as(t, session, 'post', '/admin/probe-things/self-audited').expect(201);
      const self = await t.prisma.auditLog.findMany({
        where: { action: { in: ['probe.self', 'auto:probe-things.selfAudited'] } },
      });
      expect(self.map((r) => r.action)).toEqual(['probe.self']);

      await as(t, session, 'post', '/admin/probe-things/fails').expect(400);
      expect(await t.prisma.auditLog.count({ where: { action: 'auto:probe-things.fails' } })).toBe(
        0,
      );
    });

    it('a client-chosen x-request-id shared by several calls cannot hide a mutation', async () => {
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const actionsOf = async (requestId: string) =>
        (
          await t.prisma.auditLog.findMany({
            where: { requestId },
            select: { action: true },
          })
        )
          .map((r) => r.action)
          .sort();

      // Alone, a client-chosen id still matches the handler's own audit row (no double).
      await as(t, session, 'post', '/admin/probe-things/self-audited')
        .set('x-request-id', 'solo-request-0001')
        .expect(201);
      expect(await actionsOf('solo-request-0001')).toEqual(['probe.self']);

      // Concurrent: the in-service audit row of one call must not count for the other.
      const shared = 'shared-request-0001';
      await Promise.all([
        as(t, session, 'post', '/admin/probe-things/self-audited')
          .set('x-request-id', shared)
          .expect(201),
        as(t, session, 'post', '/admin/probe-things').set('x-request-id', shared).expect(201),
      ]);
      expect(await actionsOf(shared)).toEqual(
        expect.arrayContaining(['probe.self', 'auto:probe-things.create']),
      );

      // Sequential reuse after an @Audit-decorated mutation (within the old 1 s lookup window).
      const reused = 'reused-request-0001';
      await as(t, session, 'post', '/admin/notices')
        .set('x-request-id', reused)
        .send({ title: '공지', content: '본문' })
        .expect(201);
      await as(t, session, 'post', '/admin/probe-things').set('x-request-id', reused).expect(201);
      expect(await actionsOf(reused)).toEqual(['auto:probe-things.create', 'notice.create']);
    });

    it('every admin-module mutation route carries @Audit or audits in its transaction', () => {
      const routes = t.app.get(AdminAuditCoverageService).adminMutationRoutes();
      const ours = routes.filter((r) => r.controller !== AdminProbeController.name);
      expect(ours.length).toBeGreaterThan(20);
      const ownControllers = new Set([
        'AdminReportsController',
        'AdminListingsController',
        'AdminMembersController',
        'AdminAccountsController',
        'AdminNoticesController',
        'AdminFaqsController',
        'AdminVideosController',
        'AdminTermsController',
        'AdminSiteSettingsController',
      ]);
      const undecorated = ours
        .filter((r) => ownControllers.has(r.controller) && !r.decorated)
        .map((r) => `${r.controller}.${r.handler}`);
      // These write their audit row inside their transaction (with PII-free projections).
      expect(undecorated.sort()).toEqual([
        'AdminMembersController.suspend',
        'AdminMembersController.unsuspend',
        'AdminReportsController.resolve',
        'AdminTermsController.publish',
      ]);
    });
  });
});
