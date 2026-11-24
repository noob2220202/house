import {
  AdminRole,
  AdminStatus,
  AgencyDocumentType,
  AgencyStatus,
  AssetType,
  AuthProvider,
  BannerSlot,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  DEFAULT_SGG_CODE,
  ErrorCode,
  ReportReason,
  ReportStatus,
  ReportTargetType,
  SiteSettingKey,
} from '@house/shared';
import type { PrismaService } from '../../../src/prisma/prisma.service';
import { AdminNotificationsService } from '../../../src/modules/admin/services/admin-notifications.service';
import {
  createAgency,
  createComplex,
  createListing,
  createMedia,
  createTestApp,
  createUser,
  loginAdmin,
  loginUser,
  resetAll,
  type TestApp,
  type TestSession,
} from '../../utils';
import {
  adminActor,
  api,
  as,
  auditRows,
  BROWSER_UA,
  expectAdminAuthz,
  expectCode,
  pluck,
} from './helpers';

const DAY = 86_400_000;
/** Last element of a JSON array from a response body. */
const last = (items: unknown): Record<string, unknown> | undefined =>
  (items as Record<string, unknown>[]).at(-1);
const MIN = 60_000;
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

async function seedRegions(prisma: PrismaService): Promise<void> {
  await prisma.region.create({
    data: {
      code: DEFAULT_SGG_CODE,
      name: '순천시',
      fullName: '전남광주통합특별시 순천시',
      level: 'SGG',
    },
  });
  await prisma.region.create({
    data: {
      code: `${DEFAULT_SGG_CODE}132`,
      name: '조례동',
      fullName: '전남광주통합특별시 순천시 조례동',
      level: 'EMD',
      parentCode: DEFAULT_SGG_CODE,
    },
  });
}

async function createDealRequest(
  prisma: PrismaService,
  userId: string,
  data: Partial<Parameters<PrismaService['dealRequest']['create']>[0]['data']> = {},
) {
  return prisma.dealRequest.create({
    data: {
      type: DealRequestType.SELL_OR_LEASE,
      userId,
      assetType: AssetType.APT,
      dealTypes: [DealType.SALE],
      visibility: DealRequestVisibility.ALL_AGENCIES_IN_REGION,
      sggCode: DEFAULT_SGG_CODE,
      emdCode: `${DEFAULT_SGG_CODE}132`,
      exclusiveArea: '112.40',
      floor: 12,
      desiredSalePrice: 45000,
      contactName: '내놓는사람',
      contactPhone: '01011112222',
      ...data,
    } as never,
  });
}

describe('admin dashboard queues, search, notifications, stats, social login (e2e)', () => {
  let t: TestApp;
  let userSession: TestSession;

  beforeAll(async () => {
    process.env.KAKAO_CLIENT_ID = '7f3c1234567890abcdefa91e';
    process.env.KAKAO_CLIENT_SECRET = 'kakao-secret-must-never-leak';
    t = await createTestApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    await seedRegions(t.prisma);
    userSession = await loginUser(t.app, await createUser(t.prisma));
  });
  afterAll(async () => {
    delete process.env.KAKAO_CLIENT_ID;
    delete process.env.KAKAO_CLIENT_SECRET;
    await t?.close();
  });

  // ---------------------------------------------------------------------------------------------

  describe('GET /admin/dashboard/queues', () => {
    it('previews pending agencies, open deal requests, reports per target and expiring ads', async () => {
      const now = Date.now();
      const { agency, owner } = await createAgency(t.prisma, {
        name: '연향센트럴 공인중개사사무소',
      });
      const { agency: pending } = await createAgency(t.prisma, {
        status: AgencyStatus.PENDING,
        approvedAt: null,
        name: '조례한빛 공인중개사사무소',
        emdCode: `${DEFAULT_SGG_CODE}132`,
      });
      const doc = await createMedia(t.prisma, { purpose: 'AGENCY_DOCUMENT' as never });
      await t.prisma.agencyDocument.create({
        data: { agencyId: pending.id, type: AgencyDocumentType.REGISTRATION_CERT, mediaId: doc.id },
      });
      const complex = await createComplex(t.prisma, { name: '연향 센트럴' });
      const { listing } = await createListing(t.prisma, {
        agencyId: agency.id,
        listing: { complexId: complex.id, salePrice: 31000 },
      });
      const r1 = await t.prisma.report.create({
        data: {
          targetType: ReportTargetType.LISTING,
          listingId: listing.id,
          agencyId: agency.id,
          reason: ReportReason.NOT_EXIST,
          createdAt: new Date(now - 2 * 3_600_000),
        },
      });
      const r2 = await t.prisma.report.create({
        data: {
          targetType: ReportTargetType.LISTING,
          listingId: listing.id,
          agencyId: agency.id,
          reason: ReportReason.WRONG_PRICE,
        },
      });
      await t.prisma.report.create({
        data: {
          targetType: ReportTargetType.AGENCY,
          agencyId: agency.id,
          reason: ReportReason.OTHER,
          status: ReportStatus.RESOLVED,
          createdAt: new Date(now - 31 * MIN),
          handledAt: new Date(now - MIN),
        },
      });
      const dr = await createDealRequest(t.prisma, owner.id);
      await createDealRequest(t.prisma, owner.id, { status: DealRequestStatus.CLOSED });
      const media = await createMedia(t.prisma, { purpose: 'BANNER' as never });
      const banner = await t.prisma.banner.create({
        data: {
          slot: BannerSlot.MAP_AD,
          title: '곧 끝나는 배너',
          advertiserName: '신대중앙 공인중개사사무소',
          pcMediaId: media.id,
          startAt: new Date(now - DAY),
          endAt: new Date(now + 2 * DAY),
        },
      });
      await t.prisma.bannerStatDaily.create({
        data: { bannerId: banner.id, date: new Date(), impressions: 1000, clicks: 25 },
      });
      const popup = await t.prisma.popup.create({
        data: {
          title: '이벤트 팝업',
          mediaId: media.id,
          targetPages: ['ALL'],
          startAt: new Date(now - DAY),
          endAt: new Date(now + 3 * DAY),
        },
      });

      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'get', '/admin/dashboard/queues').expect(200);
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.body.pendingAgencies).toEqual({
        total: 1,
        items: [
          {
            id: pending.id,
            name: '조례한빛 공인중개사사무소',
            areaName: '조례동',
            representativeName: pending.representativeName,
            registrationNumber: pending.registrationNumber,
            status: AgencyStatus.PENDING,
            appliedAt: pending.createdAt.toISOString(),
            documents: {
              submitted: 1,
              required: 2,
              missing: [AgencyDocumentType.BUSINESS_REG_CERT],
              missingLabel: null,
            },
            registryStatus: null,
          },
        ],
      });
      expect(res.body.dealRequests).toEqual({
        total: 1,
        items: [
          {
            id: dr.id,
            type: DealRequestType.SELL_OR_LEASE,
            title: '조례동 · 34평',
            dealType: DealType.SALE,
            price: 45000,
            deposit: null,
            monthlyRent: null,
            note: '12층',
            createdAt: dr.createdAt.toISOString(),
            deliveredAgencyCount: 0,
            activeProposalCount: 0,
          },
        ],
      });
      expect(res.body.reports).toEqual({
        total: 1,
        items: [
          {
            id: r2.id,
            targetType: ReportTargetType.LISTING,
            targetId: listing.id,
            reason: ReportReason.WRONG_PRICE,
            title: '연향 센트럴 · 26평',
            agencyName: '연향센트럴 공인중개사사무소',
            reportCount: 2,
            lastReportedAt: r2.createdAt.toISOString(),
          },
        ],
        handledThisWeek: expect.any(Number),
        avgHandleHours: expect.any(Number),
      });
      expect(r1.id).not.toBe(r2.id);
      expect(res.body.expiringAds.total).toBe(2);
      expect(res.body.expiringAds.items).toEqual([
        {
          id: banner.id,
          kind: 'BANNER',
          advertiserName: '신대중앙 공인중개사사무소',
          slot: BannerSlot.MAP_AD,
          placementLabel: null,
          endAt: banner.endAt.toISOString(),
          ctr: 0.025,
          imageUrl: expect.stringContaining(media.storageKey),
        },
        {
          id: popup.id,
          kind: 'POPUP',
          advertiserName: '이벤트 팝업',
          slot: null,
          placementLabel: '팝업',
          endAt: popup.endAt.toISOString(),
          ctr: null,
          imageUrl: expect.any(String),
        },
      ]);
    });

    it('empty queues', async () => {
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'get', '/admin/dashboard/queues').expect(200);
      expect(res.body).toEqual({
        pendingAgencies: { total: 0, items: [] },
        dealRequests: { total: 0, items: [] },
        reports: { total: 0, items: [], handledThisWeek: 0, avgHandleHours: null },
        expiringAds: { total: 0, items: [] },
      });
    });

    it('authz', async () => {
      await expectAdminAuthz(t, 'get', '/admin/dashboard/queues', { userSession });
    });
  });

  // ---------------------------------------------------------------------------------------------

  describe('GET /admin/search', () => {
    it('groups listings, agencies and (masked) members', async () => {
      const { agency } = await createAgency(t.prisma, {
        name: '연향센트럴 공인중개사사무소',
        emdCode: `${DEFAULT_SGG_CODE}132`,
      });
      const complex = await createComplex(t.prisma, { name: '연향 센트럴' });
      const { listing } = await createListing(t.prisma, {
        agencyId: agency.id,
        property: { complexId: complex.id },
        listing: { complexId: complex.id, salePrice: 31000, emdCode: `${DEFAULT_SGG_CODE}132` },
      });
      const member = await createUser(t.prisma, {
        name: '김서진',
        nickname: '연향주민',
        email: 'kim.seojin@example.com',
        phone: '01012345678',
      });
      await t.prisma.identity.create({
        data: { userId: member.id, provider: AuthProvider.KAKAO, providerUserId: 'k-1' },
      });

      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(
        t,
        session,
        'get',
        `/admin/search?q=${encodeURIComponent('연향 센트럴')}`,
      ).expect(200);
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.body.query).toBe('연향 센트럴');
      expect(res.body.listings).toEqual({
        total: 1,
        items: [
          {
            id: listing.id,
            listingNo: null,
            title: '연향 센트럴 · 26평',
            dealType: DealType.SALE,
            price: 31000,
            deposit: null,
            monthlyRent: null,
            status: 'ACTIVE',
            agencyName: '연향센트럴 공인중개사사무소',
            areaName: '조례동',
          },
        ],
      });
      // "연향 센트럴" also finds the office "연향센트럴 …" (spaces do not matter).
      expect(res.body.agencies).toEqual({
        total: 1,
        items: [
          {
            id: agency.id,
            name: agency.name,
            representativeName: agency.representativeName,
            registrationNumber: agency.registrationNumber,
            status: AgencyStatus.APPROVED,
            areaName: '조례동',
            listingCount: 0,
          },
        ],
      });

      const byPhone = await as(t, session, 'get', '/admin/search?q=5678&limit=3').expect(200);
      expect(byPhone.body.users).toEqual({
        total: 1,
        items: [
          {
            id: member.id,
            nickname: '연향주민',
            name: '김*진',
            email: 'ki***@example.com',
            phone: '010-****-5678',
            role: 'USER',
            status: 'ACTIVE',
            provider: AuthProvider.KAKAO,
            joinedAt: member.createdAt.toISOString(),
          },
        ],
      });
      expect(JSON.stringify(byPhone.body)).not.toContain('01012345678');

      // 읍면동 name and 등록번호 match too.
      const byArea = await as(
        t,
        session,
        'get',
        `/admin/search?q=${encodeURIComponent('조례')}`,
      ).expect(200);
      expect(pluck(byArea.body.agencies.items, 'id')).toEqual([agency.id]);
      expect(pluck(byArea.body.listings.items, 'id')).toEqual([listing.id]);
      const reg = agency.registrationNumber.slice(0, 10);
      const byReg = await as(
        t,
        session,
        'get',
        `/admin/search?q=${encodeURIComponent(reg)}`,
      ).expect(200);
      expect(pluck(byReg.body.agencies.items, 'id')).toEqual([agency.id]);
    });

    it('limits each group but reports the full total', async () => {
      for (let i = 0; i < 4; i += 1) await createUser(t.prisma, { nickname: `검색대상${i}` });
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(
        t,
        session,
        'get',
        `/admin/search?q=${encodeURIComponent('검색대상')}&limit=3`,
      ).expect(200);
      expect(res.body.users.total).toBe(4);
      expect(res.body.users.items).toHaveLength(3);
      expect(res.body.listings).toEqual({ total: 0, items: [] });
    });

    it('validation: q needs 2 characters, limit ≤ 20', async () => {
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const short = await as(t, session, 'get', '/admin/search?q=a').expect(400);
      expectCode(short, ErrorCode.VALIDATION_FAILED);
      expect(short.body.details).toEqual([
        expect.objectContaining({ path: 'q', message: '검색어를 2자 이상 입력해 주세요.' }),
      ]);
      await as(t, session, 'get', '/admin/search').expect(400);
      await as(t, session, 'get', '/admin/search?q=%20-%20').expect(400);
      await as(t, session, 'get', '/admin/search?q=ab&limit=21').expect(400);
    });

    it('authz', async () => {
      await expectAdminAuthz(t, 'get', '/admin/search?q=ab', { userSession });
    });
  });

  // ---------------------------------------------------------------------------------------------

  describe('notifications', () => {
    async function seedEvents() {
      const now = Date.now();
      const { agency, owner } = await createAgency(t.prisma, {
        name: '연향센트럴 공인중개사사무소',
      });
      await createAgency(t.prisma, {
        status: AgencyStatus.PENDING,
        approvedAt: null,
        name: '조례한빛 공인중개사사무소',
        representativeName: '서준호',
        createdAt: new Date(now - 95 * MIN),
      });
      const { listing } = await createListing(t.prisma, { agencyId: agency.id });
      await t.prisma.report.create({
        data: {
          targetType: ReportTargetType.LISTING,
          listingId: listing.id,
          agencyId: agency.id,
          reason: ReportReason.NOT_EXIST,
          createdAt: new Date(now - 40 * MIN),
        },
      });
      await t.prisma.report.create({
        data: {
          targetType: ReportTargetType.LISTING,
          listingId: listing.id,
          agencyId: agency.id,
          reason: ReportReason.WRONG_PRICE,
          createdAt: new Date(now - 20 * MIN),
        },
      });
      // Waiting for assignment (> 30 min, no target) …
      await createDealRequest(t.prisma, owner.id, { createdAt: new Date(now - 2 * 3_600_000) });
      // … and too fresh to count.
      await createDealRequest(t.prisma, owner.id, { createdAt: new Date(now - 5 * MIN) });
      const media = await createMedia(t.prisma, { purpose: 'BANNER' as never });
      await t.prisma.banner.create({
        data: {
          slot: BannerSlot.MAP_AD,
          title: '배너',
          advertiserName: '신대중앙 공인중개사사무소',
          pcMediaId: media.id,
          startAt: new Date(now - DAY),
          endAt: new Date(now + 2 * DAY + 60 * MIN),
        },
      });
    }

    it('derives the feed from the source tables, newest first, with per-admin read state', async () => {
      await seedEvents();
      const a = await adminActor(t, AdminRole.OPERATOR);
      const b = await adminActor(t, AdminRole.ADMIN);

      const res = await as(t, a.session, 'get', '/admin/notifications').expect(200);
      expect(res.headers['cache-control']).toContain('no-store');
      expect(res.body.unreadCount).toBe(5);
      expect(res.body.nextCursor).toBeNull();
      // Dated by event time; an ad notice by when its 3-day window opened (here ~23 h ago).
      expect(pluck(res.body.items, 'kind')).toEqual([
        'REPORT_RECEIVED',
        'REPORT_RECEIVED',
        'DEAL_REQUEST_UNASSIGNED',
        'AGENCY_APPLIED',
        'AD_EXPIRING',
      ]);
      const [report2, report1, deal, applied, ad] = res.body.items;
      expect(ad).toMatchObject({
        title: expect.stringMatching(/^광고 종료 [23]일 전$/),
        body: '신대중앙 공인중개사사무소 · 지도 광고',
        link: expect.stringMatching(/^\/banners\?edit=/),
        readAt: null,
      });
      expect(report2.title).toBe('허위매물 신고가 접수됐어요 (2건째)');
      expect(report1.title).toBe('허위매물 신고가 접수됐어요');
      expect(report1.body).toContain('연향센트럴 공인중개사사무소');
      expect(report1.link).toMatch(/^\/reports\//);
      expect(deal).toMatchObject({
        title: '내놓기 요청이 배정을 기다리고 있어요',
        body: '조례동 · 34평 · 매매 4억 5,000',
        link: expect.stringMatching(/^\/deal-requests\//),
      });
      expect(applied).toMatchObject({
        title: '서류 보완이 필요한 승인 요청',
        body: '조례한빛 공인중개사사무소 · 대표 서준호 · 중개사무소 등록증 · 사업자등록증 누락',
      });
      expect(Object.keys(applied as object).sort()).toEqual(
        ['body', 'createdAt', 'id', 'kind', 'link', 'readAt', 'title'].sort(),
      );

      // Re-syncing never duplicates.
      expect(await t.app.get(AdminNotificationsService).sync()).toBe(0);

      // Read one → only for this admin.
      const one = await as(t, a.session, 'post', `/admin/notifications/${report1.id}/read`).expect(
        200,
      );
      expect(one.body).toEqual({ id: report1.id, unreadCount: 4 });
      await as(t, a.session, 'post', `/admin/notifications/${report1.id}/read`).expect(200);
      const audit = await auditRows(t, 'admin-notification.read');
      expect(audit).toHaveLength(2);
      expect(audit[0]).toMatchObject({ resourceId: report1.id, adminUserId: a.admin.id });

      const after = await as(t, a.session, 'get', '/admin/notifications').expect(200);
      expect(
        (after.body.items as { id: string; readAt: string | null }[]).find(
          (n) => n.id === report1.id,
        )?.readAt,
      ).toEqual(expect.any(String));
      const unread = await as(t, a.session, 'get', '/admin/notifications?unreadOnly=true').expect(
        200,
      );
      expect(unread.body.items).toHaveLength(4);
      expect(
        (await as(t, b.session, 'get', '/admin/notifications').expect(200)).body.unreadCount,
      ).toBe(5);

      // The dashboard carries this admin's unread count.
      const dash = await as(t, a.session, 'get', '/admin/dashboard').expect(200);
      expect(dash.body.notificationsUnread).toBe(4);

      // Read all.
      const all = await as(t, a.session, 'post', '/admin/notifications/read-all').expect(200);
      expect(all.body).toEqual({ updated: 4, unreadCount: 0 });
      expect(await auditRows(t, 'admin-notification.read-all')).toHaveLength(1);
      const none = await as(t, a.session, 'get', '/admin/notifications?unreadOnly=1').expect(200);
      expect(none.body).toEqual({ items: [], nextCursor: null, unreadCount: 0 });
      expect(
        (await as(t, b.session, 'get', '/admin/notifications').expect(200)).body.unreadCount,
      ).toBe(5);
    });

    it('cursor pagination', async () => {
      await seedEvents();
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const first = await as(t, session, 'get', '/admin/notifications?limit=2').expect(200);
      expect(first.body.items).toHaveLength(2);
      expect(first.body.nextCursor).toEqual(expect.any(String));
      const second = await as(
        t,
        session,
        'get',
        `/admin/notifications?limit=2&cursor=${first.body.nextCursor}`,
      ).expect(200);
      const third = await as(
        t,
        session,
        'get',
        `/admin/notifications?limit=2&cursor=${second.body.nextCursor}`,
      ).expect(200);
      expect(third.body.nextCursor).toBeNull();
      const ids = [...first.body.items, ...second.body.items, ...third.body.items].map(
        (n: { id: string }) => n.id,
      );
      expect(new Set(ids).size).toBe(5);
    });

    it('errors and authz', async () => {
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const missing = await as(
        t,
        session,
        'post',
        '/admin/notifications/0190a000-0000-7000-8000-000000000000/read',
      ).expect(404);
      expectCode(missing, ErrorCode.NOT_FOUND);
      expect(missing.body.message).toBe('알림을 찾을 수 없습니다.');
      await as(t, session, 'post', '/admin/notifications/not-a-uuid/read').expect(400);
      await as(t, session, 'get', '/admin/notifications?limit=0').expect(400);
      await expectAdminAuthz(t, 'get', '/admin/notifications', { userSession });
      await expectAdminAuthz(t, 'post', '/admin/notifications/read-all', { userSession });
    });

    it('purges notifications past the retention period', async () => {
      await t.prisma.adminNotification.create({
        data: {
          kind: 'SYSTEM',
          title: '오래된 알림',
          dedupeKey: 'old',
          createdAt: new Date(Date.now() - 100 * DAY),
        },
      });
      expect(await t.app.get(AdminNotificationsService).purgeExpired()).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------------------------

  describe('GET /admin/stats/:section', () => {
    it('traffic: visitors, counted requests, devices and signups per provider', async () => {
      await t.http().get(api('/notices')).set('User-Agent', BROWSER_UA).expect(200);
      await t.http().get(api('/faqs')).set('User-Agent', BROWSER_UA).expect(200);
      await t.http().get(api('/notices')).set('User-Agent', MOBILE_UA).expect(200);
      const kakao = await createUser(t.prisma);
      await t.prisma.identity.create({
        data: { userId: kakao.id, provider: AuthProvider.KAKAO, providerUserId: 'k-2' },
      });
      // A pending visitor-counter write is fire-and-forget; give it a moment.
      await new Promise((r) => setTimeout(r, 50));

      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'get', '/admin/stats/traffic?days=7').expect(200);
      expect(res.body.days).toBe(7);
      expect(res.body.points).toHaveLength(7);
      const today = last(res.body.points);
      expect(today).toMatchObject({ visitors: 2, pageViews: 3 });
      expect(today?.signups).toBeGreaterThanOrEqual(2);
      expect(today?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(res.body.previous).toEqual({ visitors: 0, pageViews: 0, signups: 0 });
      expect(res.body.devices).toEqual({ mobile: 1, desktop: 2 });
      expect(res.body.signupsByProvider).toEqual([{ provider: AuthProvider.KAKAO, count: 1 }]);
      expect(res.body.topPages).toEqual([]);

      const def = await as(t, session, 'get', '/admin/stats/traffic').expect(200);
      expect(def.body.days).toBe(30);
      expect(def.body.points).toHaveLength(30);
    });

    it('listings: published / closed per day, active split and top complexes', async () => {
      const { agency } = await createAgency(t.prisma);
      const complex = await createComplex(t.prisma, {
        name: '신대 레이크파크 1단지',
        viewCount: 77,
      });
      await createListing(t.prisma, {
        agencyId: agency.id,
        property: { complexId: complex.id },
        listing: { complexId: complex.id },
      });
      await createListing(t.prisma, {
        agencyId: agency.id,
        listing: { dealType: DealType.JEONSE, deposit: 20000, salePrice: null },
      });
      await createListing(t.prisma, {
        agencyId: agency.id,
        listing: {
          status: 'CLOSED',
          closedAt: new Date(),
          publishedAt: new Date(Date.now() - 10 * DAY),
        },
      });
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'get', '/admin/stats/listings?days=7').expect(200);
      expect(last(res.body.points)).toMatchObject({ created: 2, closed: 1 });
      expect(res.body.previous).toEqual({ created: 1, closed: 0 });
      expect(res.body.activeTotal).toBe(2);
      expect(res.body.byAssetType).toEqual([{ assetType: AssetType.APT, count: 2 }]);
      expect(res.body.byDealType).toEqual(
        expect.arrayContaining([
          { dealType: DealType.SALE, count: 1 },
          { dealType: DealType.JEONSE, count: 1 },
        ]),
      );
      expect(res.body.topComplexes).toEqual([
        { id: complex.id, name: '신대 레이크파크 1단지', views: 77, listings: 1 },
      ]);
    });

    it('deal-requests: sell / find / proposals, response rate, first response and regions', async () => {
      const { agency, owner } = await createAgency(t.prisma);
      const sell = await createDealRequest(t.prisma, owner.id, {
        createdAt: new Date(Date.now() - 2 * MIN),
      });
      await createDealRequest(t.prisma, owner.id, {
        type: DealRequestType.WANTED,
        emdCode: null,
        regionCodes: [],
      });
      await t.prisma.proposal.create({
        data: {
          dealRequestId: sell.id,
          agencyId: agency.id,
          message: '제안드립니다',
          createdAt: new Date(Date.now() - MIN),
        },
      });
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'get', '/admin/stats/deal-requests?days=7').expect(200);
      expect(last(res.body.points)).toMatchObject({ sell: 1, find: 1, proposals: 1 });
      expect(res.body.previous).toEqual({ sell: 0, find: 0, proposals: 0 });
      expect(res.body.responseRate).toBe(0.5);
      expect(res.body.avgFirstResponseMinutes).toBe(1);
      expect(res.body.byRegion).toEqual([
        { name: '조례동', count: 1 },
        { name: '그 밖의 지역', count: 1 },
      ]);
    });

    it('ads: impressions / clicks per day and per slot', async () => {
      const media = await createMedia(t.prisma, { purpose: 'BANNER' as never });
      const banner = await t.prisma.banner.create({
        data: {
          slot: BannerSlot.MAIN_HERO,
          title: '배너',
          pcMediaId: media.id,
          startAt: new Date(Date.now() - DAY),
          endAt: new Date(Date.now() + 10 * DAY),
        },
      });
      const kstToday = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
      await t.prisma.bannerStatDaily.create({
        data: {
          bannerId: banner.id,
          date: new Date(`${kstToday}T00:00:00Z`),
          impressions: 500,
          clicks: 12,
        },
      });
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'get', '/admin/stats/ads?days=30').expect(200);
      expect(res.body.points).toHaveLength(30);
      expect(last(res.body.points)).toEqual({ date: kstToday, impressions: 500, clicks: 12 });
      expect(res.body.previous).toEqual({ impressions: 0, clicks: 0 });
      expect(res.body.activeBanners).toBe(1);
      expect(res.body.bySlot).toEqual([
        { slot: 'MAIN_HERO', label: '메인 상단 대형', impressions: 500, clicks: 12 },
      ]);
    });

    it('validation and authz', async () => {
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const bad = await as(t, session, 'get', '/admin/stats/traffic?days=14').expect(400);
      expectCode(bad, ErrorCode.VALIDATION_FAILED);
      expect(bad.body.details).toEqual([
        expect.objectContaining({
          path: 'days',
          message: '조회 기간은 7, 30, 90일 중에서 고를 수 있습니다.',
        }),
      ]);
      await as(t, session, 'get', '/admin/stats/unknown').expect(400);
      for (const section of ['traffic', 'listings', 'deal-requests', 'ads']) {
        await expectAdminAuthz(t, 'get', `/admin/stats/${section}?days=7`, { userSession });
      }
    });
  });

  // ---------------------------------------------------------------------------------------------

  describe('GET /admin/social-login', () => {
    it('reports configuration and sign-in activity, never secrets (ADMIN+)', async () => {
      const kakao = await createUser(t.prisma);
      await t.prisma.identity.create({
        data: {
          userId: kakao.id,
          provider: AuthProvider.KAKAO,
          providerUserId: 'k-3',
          lastUsedAt: new Date(Date.now() - 2 * MIN),
        },
      });
      const { session } = await adminActor(t, AdminRole.ADMIN);
      const res = await as(t, session, 'get', '/admin/social-login').expect(200);
      expect(pluck(res.body.items, 'provider')).toEqual(['KAKAO', 'NAVER', 'GOOGLE']);
      const [k, n] = res.body.items;
      expect(k).toEqual({
        provider: 'KAKAO',
        enabled: true,
        healthy: true,
        clientIdMasked: '7f3c••••••••••••••••a91e',
        callbackUrl: 'http://localhost:4000/api/v1/auth/oauth/kakao/callback',
        lastSuccessAt: expect.any(String),
        last24h: { success: 1, failure: 0 },
        userShare: expect.any(Number),
        message: null,
      });
      expect(n).toMatchObject({
        enabled: false,
        healthy: false,
        clientIdMasked: null,
        lastSuccessAt: null,
        message: expect.stringContaining('클라이언트 ID'),
      });
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('kakao-secret-must-never-leak');
      expect(raw).not.toContain('7f3c1234567890abcdefa91e');
      expect(raw).not.toContain('APPLE');
    });

    it('authz (OPERATOR → 403)', async () => {
      await expectAdminAuthz(t, 'get', '/admin/social-login', {
        userSession,
        lowRole: AdminRole.OPERATOR,
      });
    });
  });

  // ---------------------------------------------------------------------------------------------

  describe('PUT /admin/videos/order', () => {
    const video = (title: string, sortOrder: number) =>
      t.prisma.localVideo.create({
        data: {
          title,
          youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          youtubeVideoId: 'dQw4w9WgXcQ',
          sortOrder,
        },
      });

    it('sets sortOrder 1…n in the given order, audited (CONTENT_MANAGE)', async () => {
      const a = await video('가', 0);
      const b = await video('나', 1);
      const c = await video('다', 2);
      const { admin, session } = await adminActor(t, AdminRole.OPERATOR);
      await as(t, session, 'put', '/admin/videos/order')
        .send({ ids: [c.id, a.id, b.id] })
        .expect(204);
      const rows = await t.prisma.localVideo.findMany({ orderBy: { sortOrder: 'asc' } });
      expect(rows.map((r) => [r.id, r.sortOrder])).toEqual([
        [c.id, 1],
        [a.id, 2],
        [b.id, 3],
      ]);
      const audit = await auditRows(t, 'video.reorder');
      expect(audit).toEqual([
        expect.objectContaining({ adminUserId: admin.id, resourceType: 'LocalVideo' }),
      ]);
      const pub = await t.http().get(api('/videos')).expect(200);
      expect(pluck(pub.body.items, 'id')).toEqual([c.id, a.id, b.id]);
    });

    it('validation: unknown / deleted / duplicate ids', async () => {
      const a = await video('가', 0);
      const gone = await video('삭제', 1);
      await t.prisma.localVideo.update({ where: { id: gone.id }, data: { deletedAt: new Date() } });
      const { session } = await adminActor(t, AdminRole.OPERATOR);
      const res = await as(t, session, 'put', '/admin/videos/order')
        .send({ ids: [a.id, gone.id] })
        .expect(400);
      expectCode(res, ErrorCode.VALIDATION_FAILED);
      expect(res.body.details).toEqual({ unknownIds: [gone.id] });
      await as(t, session, 'put', '/admin/videos/order')
        .send({ ids: [a.id, a.id] })
        .expect(400);
      await as(t, session, 'put', '/admin/videos/order').send({ ids: [] }).expect(400);
      await expectAdminAuthz(t, 'put', '/admin/videos/order', {
        userSession,
        body: { ids: [a.id] },
      });
    });
  });

  // ---------------------------------------------------------------------------------------------

  describe('DELETE /admin/admins/:id', () => {
    it('soft-deletes: hidden, e-mail released, sessions ended, audited (SUPER_ADMIN)', async () => {
      const { admin: actor, session } = await adminActor(t, AdminRole.SUPER_ADMIN);
      const target = await adminActor(t, AdminRole.ADMIN);
      await as(t, target.session, 'get', '/admin/permissions').expect(200);

      await as(t, session, 'delete', `/admin/admins/${target.admin.id}`).expect(204);

      const row = await t.prisma.adminUser.findUniqueOrThrow({ where: { id: target.admin.id } });
      expect(row).toMatchObject({
        status: AdminStatus.DISABLED,
        email: `deleted+${target.admin.id}@deleted.invalid`,
        totpSecretEnc: null,
      });
      expect(
        await t.prisma.adminAccountDeletion.findUnique({ where: { adminUserId: target.admin.id } }),
      ).toMatchObject({ originalEmail: target.admin.email, deletedByAdminId: actor.id });
      await as(t, target.session, 'get', '/admin/permissions').expect(401);
      const list = await as(t, session, 'get', '/admin/admins').expect(200);
      expect(pluck(list.body.items, 'id')).not.toContain(target.admin.id);
      await as(t, session, 'get', `/admin/admins/${target.admin.id}`).expect(404);
      await as(t, session, 'delete', `/admin/admins/${target.admin.id}`).expect(404);
      await as(t, session, 'patch', `/admin/admins/${target.admin.id}`)
        .send({ name: '부활' })
        .expect(404);
      // The e-mail can be used for a new account.
      await as(t, session, 'post', '/admin/admins')
        .send({
          email: target.admin.email,
          name: '새 관리자',
          role: AdminRole.OPERATOR,
          password: 'Very-Long-Password-2026!',
        })
        .expect(201);
      const audit = await auditRows(t, 'admin-account.delete');
      expect(audit).toEqual([
        expect.objectContaining({
          adminUserId: actor.id,
          resourceType: 'AdminUser',
          resourceId: target.admin.id,
          // Audit snapshots redact e-mail addresses.
          before: expect.objectContaining({ id: target.admin.id, role: AdminRole.ADMIN }),
        }),
      ]);
    });

    it('refuses self-deletion; ADMIN → 403; unknown → 404', async () => {
      const { admin, session } = await adminActor(t, AdminRole.SUPER_ADMIN);
      const self = await as(t, session, 'delete', `/admin/admins/${admin.id}`).expect(403);
      expectCode(self, ErrorCode.ADMIN_SELF_MODIFICATION);
      expect(self.body.message).toBe('본인 계정은 삭제할 수 없습니다.');
      await as(t, session, 'delete', '/admin/admins/0190a000-0000-7000-8000-000000000000').expect(
        404,
      );
      const target = await adminActor(t, AdminRole.OPERATOR);
      await expectAdminAuthz(t, 'delete', `/admin/admins/${target.admin.id}`, {
        userSession,
        lowRole: AdminRole.ADMIN,
      });
    });

    it('keeps at least one active SUPER_ADMIN', async () => {
      const lone = await adminActor(t, AdminRole.SUPER_ADMIN);
      // A second, already disabled super admin acting through a still-valid session.
      const other = await t.prisma.adminUser.create({
        data: {
          email: 'other-super@example.test',
          name: '다른 최고관리자',
          passwordHash: 'x',
          role: AdminRole.SUPER_ADMIN,
          status: AdminStatus.DISABLED,
        },
      });
      const otherSession = await loginAdmin(t.app, { id: other.id, role: AdminRole.SUPER_ADMIN });
      const res = await as(t, otherSession, 'delete', `/admin/admins/${lone.admin.id}`);
      // Either the disabled actor is refused outright, or the invariant answers 409.
      expect([401, 403, 409]).toContain(res.status);
      expect(
        (await t.prisma.adminUser.findUniqueOrThrow({ where: { id: lone.admin.id } })).status,
      ).toBe(AdminStatus.ACTIVE);
    });
  });

  // ---------------------------------------------------------------------------------------------

  describe('site settings (D9 HOME_LAYOUT)', () => {
    it('GET/PUT carry updatedByAdminName for the admin app', async () => {
      const { admin, session } = await adminActor(t, AdminRole.ADMIN);
      const empty = await as(t, session, 'get', '/admin/site-settings/HOME_LAYOUT').expect(200);
      expect(empty.body).toEqual({
        key: SiteSettingKey.HOME_LAYOUT,
        value: null,
        updatedAt: null,
        updatedBy: null,
        updatedByAdminName: null,
      });
      const layout = {
        sections: [
          { key: 'HERO_SEARCH', visible: true },
          { key: 'APP_BAND', visible: false },
        ],
      };
      const put = await as(t, session, 'put', '/admin/site-settings/HOME_LAYOUT')
        .send(layout)
        .expect(200);
      expect(put.body).toMatchObject({
        key: 'HOME_LAYOUT',
        value: layout,
        updatedBy: { id: admin.id, name: admin.name },
        updatedByAdminName: admin.name,
      });
      const got = await as(t, session, 'get', '/admin/site-settings/HOME_LAYOUT').expect(200);
      expect(got.body.updatedByAdminName).toBe(admin.name);
      await expectAdminAuthz(t, 'get', '/admin/site-settings/HOME_LAYOUT', {
        userSession,
        lowRole: AdminRole.OPERATOR,
      });
    });
  });
});
