import {
  AgencyStatus,
  AssetType,
  DealRequestStatus,
  DealRequestType,
  DealRequestVisibility,
  DealType,
  ListingAgencyStatus,
  ListingStatus,
  NotificationType,
  ProposalStatus,
} from '@house/shared';
import { NotificationsService } from '../../../src/modules/deal-requests/notifications/notifications.service';
import {
  createAgency,
  createComplex,
  createListing,
  createMedia,
  createUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import {
  agent,
  broker,
  createDealRequestsApp,
  dealRequest,
  itemIds,
  proposal,
  requester,
} from './factories';

const DAY = 86_400_000;
const JORYE = '12150133';
const YEONHYANG = '12150114';

describe('deal-requests: console additions (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    ({ t } = await createDealRequestsApp());
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  async function regions(): Promise<void> {
    await t.prisma.region.create({
      data: { code: '12150', name: '순천시', fullName: '전남광주통합특별시 순천시', level: 'SGG' },
    });
    for (const [code, name] of [
      [JORYE, '조례동'],
      [YEONHYANG, '연향동'],
      ['12150310', '해룡면'],
    ] as const) {
      await t.prisma.region.create({
        data: { code, name, fullName: `순천시 ${name}`, level: 'EMD', parentCode: '12150' },
      });
    }
    await t.prisma.region.create({
      data: {
        code: '1215031022',
        name: '신대리',
        fullName: '순천시 해룡면 신대리',
        level: 'RI',
        parentCode: '12150310',
      },
    });
  }

  // ------------------------------------------------------------------ dashboard

  describe('GET /api/v1/agencies/mine/dashboard', () => {
    it('200: listing counters, views, expiring / verification lists, request feed', async () => {
      const b = await broker(t);
      const other = await broker(t);
      const now = Date.now();
      const { listing: soon } = await createListing(t.prisma, {
        agencyId: b.agency.id,
        listing: {
          title: '조례 아파트 101동',
          expiresAt: new Date(now + 2 * DAY),
          verifiedAt: new Date(now - 28 * DAY),
          viewCount: 30,
        },
        property: { supplyArea: '112.40', floor: 20, totalFloors: 25 },
      });
      const { listing: fresh } = await createListing(t.prisma, {
        agencyId: b.agency.id,
        listing: {
          dealType: DealType.JEONSE,
          salePrice: null,
          deposit: 31000,
          expiresAt: new Date(now + 25 * DAY),
          verifiedAt: new Date(now - 5 * DAY),
          viewCount: 12,
        },
      });
      const { listing: never } = await createListing(t.prisma, {
        agencyId: b.agency.id,
        listing: { status: ListingStatus.RESERVED, expiresAt: new Date(now + 20 * DAY) },
      });
      await createListing(t.prisma, {
        agencyId: b.agency.id,
        listing: { status: ListingStatus.DRAFT },
      });
      await createListing(t.prisma, {
        agencyId: b.agency.id,
        listing: { status: ListingStatus.CLOSED, closedAt: new Date(now - 3 * DAY) },
      });
      await createListing(t.prisma, {
        agencyId: b.agency.id,
        listing: { status: ListingStatus.CLOSED, closedAt: new Date(now - 40 * DAY) },
      });
      await createListing(t.prisma, {
        agencyId: b.agency.id,
        listing: { deletedAt: new Date(), viewCount: 999 },
      });
      // Co-brokered for another office.
      const { listing: co } = await createListing(t.prisma, { agencyId: other.agency.id });
      await t.prisma.listingAgency.create({
        data: { listingId: co.id, agencyId: b.agency.id, isPrimary: false },
      });
      // Favorites this week on our listings (and an old one, and one on someone else's).
      const fan = await createUser(t.prisma);
      const fan2 = await createUser(t.prisma);
      await t.prisma.favoriteListing.createMany({
        data: [
          { userId: fan.id, listingId: soon.id },
          { userId: fan2.id, listingId: soon.id, createdAt: new Date(now - 10 * DAY) },
          { userId: fan.id, listingId: fresh.id },
        ],
      });
      // Yesterday's snapshot: today's views = (30 + 12 + co 0) − 30 = 12.
      const today = new Date(now + 9 * 3_600_000).toISOString().slice(0, 10);
      const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - DAY);
      await t.prisma.agencyDailyStat.create({
        data: { agencyId: b.agency.id, day: yesterday, listingViews: 30 },
      });
      // Requests: two new (sell + wanted), one we proposed to.
      const { user } = await requester(t);
      const sell = await dealRequest(t.prisma, user.id, { createdAt: new Date(now - 3000) });
      const wanted = await dealRequest(t.prisma, user.id, {
        type: DealRequestType.WANTED,
        createdAt: new Date(now - 2000),
        roadAddress: null,
        addressDetail: null,
        desiredSalePrice: null,
        regionCodes: [JORYE],
        priceMax: 40000,
      });
      const proposed = await dealRequest(t.prisma, user.id, { createdAt: new Date(now - 1000) });
      await proposal(t.prisma, proposed.id, b.agency.id);

      const res = await withSession(t.http().get('/api/v1/agencies/mine/dashboard'), b.s).expect(
        200,
      );
      expect(res.body.listings).toEqual({
        active: 3, // soon, fresh, co-brokered
        reserved: 1,
        draft: 1,
        closed30d: 1,
        coBrokered: 1,
      });
      expect(res.body.views).toMatchObject({
        total7d: 12,
        changeRatio: null,
        profileViews7d: 0,
        favorites7d: 2,
      });
      expect(res.body.views.daily).toHaveLength(7);
      expect(res.body.views.daily[6]).toEqual({ date: today, views: 12 });
      expect(res.body.expiringListings).toEqual([
        {
          id: soon.id,
          title: '조례 아파트 101동',
          summary: '34평 · 20/25층',
          dealType: 'SALE',
          price: 30000,
          deposit: null,
          monthlyRent: null,
          expiresAt: soon.expiresAt!.toISOString(),
          verifiedAt: soon.verifiedAt!.toISOString(),
          verificationDueAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        },
      ]);
      // Never verified first, then the stale one; the freshly verified one is not due.
      expect(itemIds({ items: res.body.verificationDue })).toEqual([never.id, soon.id]);
      expect(res.body.verificationDue[0].verificationDueAt).toBeNull();
      expect(res.body.dealRequests).toMatchObject({
        newCount: 2,
        newSellCount: 1,
        newWantedCount: 1,
      });
      expect(itemIds(res.body.dealRequests)).toEqual([proposed.id, wanted.id, sell.id]);
      expect(res.body.dealRequests.items[0]).toMatchObject({
        myProposal: { status: ProposalStatus.SENT },
        contact: null,
      });
      expect(JSON.stringify(res.body)).not.toContain('01012345678');
      // No inquiries yet (the inquiry block has its own case below).
      expect(res.body.inquiries).toEqual({ unreadCount: 0, items: [] });
      // The read also wrote today's snapshot.
      const snap = await t.prisma.agencyDailyStat.findFirst({
        where: { agencyId: b.agency.id, day: new Date(`${today}T00:00:00Z`) },
      });
      expect(snap?.listingViews).toBe(42);
    });

    it('inquiry block: unread rows of the office + its latest 3 written inquiries', async () => {
      const b = await broker(t);
      const other = await broker(t);
      const at = (min: number) => new Date(Date.now() - min * 60_000);
      const message = (agencyId: string, min: number, extra: Record<string, unknown> = {}) =>
        t.prisma.inquiry.create({
          data: {
            agencyId,
            channel: 'MESSAGE',
            source: 'MAIN',
            customerName: '홍길동',
            customerPhone: '01012345678',
            message: `문의 ${min}`,
            lastMessageAt: at(min),
            ...extra,
          },
        });
      const oldest = await message(b.agency.id, 50);
      const m3 = await message(b.agency.id, 40, { readAt: at(1) });
      const m2 = await message(b.agency.id, 30);
      const m1 = await message(b.agency.id, 20);
      await message(b.agency.id, 1, { deletedAt: at(0) });
      await message(other.agency.id, 5);
      // A contact event is unread too but never one of the written items.
      await t.prisma.inquiry.create({
        data: { agencyId: b.agency.id, channel: 'CALL', source: 'SITE', lastMessageAt: at(2) },
      });
      const res = await withSession(t.http().get('/api/v1/agencies/mine/dashboard'), b.s).expect(
        200,
      );
      // unread: oldest, m2, m1 + the call (m3 is read, the deleted one does not count).
      expect(res.body.inquiries.unreadCount).toBe(4);
      expect(itemIds(res.body.inquiries)).toEqual([m1.id, m2.id, m3.id]);
      expect(itemIds(res.body.inquiries)).not.toContain(oldest.id);
      expect(res.body.inquiries.items[0]).toMatchObject({
        channel: 'MESSAGE',
        customerName: '홍길동',
        isMember: false,
        canReply: false,
      });
    });

    it('200 for an AGENT of the agency; empty office gives zero values', async () => {
      const b = await broker(t);
      const a = await agent(t, b.agency);
      const res = await withSession(t.http().get('/api/v1/agencies/mine/dashboard'), a.s).expect(
        200,
      );
      expect(res.body).toMatchObject({
        listings: { active: 0, reserved: 0, draft: 0, closed30d: 0, coBrokered: 0 },
        views: { total7d: 0, changeRatio: null, profileViews7d: 0, favorites7d: 0 },
        dealRequests: { newCount: 0, newSellCount: 0, newWantedCount: 0, items: [] },
        inquiries: { unreadCount: 0, items: [] },
        expiringListings: [],
        verificationDue: [],
      });
      const daily = res.body.views.daily as { views: number }[];
      expect(daily.every((d) => d.views === 0)).toBe(true);
    });

    it('401 anonymous; 403 for USER, a suspended agency or a removed member', async () => {
      await t.http().get('/api/v1/agencies/mine/dashboard').expect(401);
      const { s } = await requester(t);
      await withSession(t.http().get('/api/v1/agencies/mine/dashboard'), s).expect(403);
      const b = await broker(t, { status: AgencyStatus.SUSPENDED });
      await withSession(t.http().get('/api/v1/agencies/mine/dashboard'), b.s).expect(403);
      const ok = await broker(t);
      const a = await agent(t, ok.agency);
      await t.prisma.agencyMember.updateMany({
        where: { userId: a.user.id },
        data: { status: 'REMOVED', removedAt: new Date() },
      });
      await withSession(t.http().get('/api/v1/agencies/mine/dashboard'), a.s).expect(403);
    });
  });

  // ------------------------------------------------------------------ target agencies

  describe('GET /api/v1/deal-requests/target-agencies', () => {
    it('200: approved offices of the service 시군구 (reach), local first, area label, public', async () => {
      await regions();
      const far = await createAgency(t.prisma, { emdCode: YEONHYANG, activeListingCount: 50 });
      const near = await createAgency(t.prisma, {
        emdCode: JORYE,
        activeListingCount: 3,
        specialties: [AssetType.APT, AssetType.OFFICETEL],
      });
      await createAgency(t.prisma, { emdCode: JORYE, status: AgencyStatus.PENDING });
      await createAgency(t.prisma, { emdCode: JORYE, deletedAt: new Date() });
      await createAgency(t.prisma, { sggCode: '46130', emdCode: '4613010100' });

      const res = await t
        .http()
        .get(`/api/v1/deal-requests/target-agencies?regionCodes=${JORYE}&pageSize=3`)
        .expect(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 3, totalPages: 1 });
      expect(res.body.areaLabel).toBe('조례동');
      expect(itemIds(res.body)).toEqual([near.agency.id, far.agency.id]);
      expect(res.body.items[0]).toEqual({
        id: near.agency.id,
        name: near.agency.name,
        representativeName: near.agency.representativeName,
        phone: near.agency.phone,
        roadAddress: near.agency.roadAddress,
        specialty: '아파트·오피스텔 전문',
        activeListingCount: 3,
        avgResponseMinutes: null,
        logoUrl: null,
      });

      // Legacy 46150 codes are canonicalized; several codes → joined label.
      const legacy = await t
        .http()
        .get('/api/v1/deal-requests/target-agencies?regionCodes=4615011400,1215013300')
        .expect(200);
      expect(legacy.body.areaLabel).toBe('연향동·조례동');
      expect(itemIds(legacy.body)).toEqual([far.agency.id, near.agency.id]);
    });

    it('200: `q` searches 상호 / 대표 / 주소 for the picker; pages', async () => {
      const logo = await createMedia(t.prisma, { storageKey: 'logos/a.webp' });
      const a = await createAgency(t.prisma, { name: '조례한빛공인중개사', logoMediaId: logo.id });
      await createAgency(t.prisma, { name: '연향부동산', representativeName: '한빛나' });
      await createAgency(t.prisma, { name: '다른사무소' });
      const res = await t.http().get('/api/v1/deal-requests/target-agencies?q=한빛').expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.areaLabel).toBeNull();
      const items = res.body.items as { id: string; logoUrl: string | null }[];
      const hit = items.find((i) => i.id === a.agency.id);
      expect(hit?.logoUrl).toEqual(expect.stringContaining('logos/a'));
      const page2 = await t
        .http()
        .get('/api/v1/deal-requests/target-agencies?pageSize=2&page=2')
        .expect(200);
      expect(page2.body).toMatchObject({ total: 3, page: 2, totalPages: 2 });
      expect(page2.body.items).toHaveLength(1);
      // %/_ are literal.
      const like = await t.http().get('/api/v1/deal-requests/target-agencies?q=%25').expect(200);
      expect(like.body.total).toBe(0);
    });

    it('400 for invalid region codes / page size', async () => {
      await t.http().get('/api/v1/deal-requests/target-agencies?regionCodes=abc').expect(400);
      await t.http().get('/api/v1/deal-requests/target-agencies?emdCode=1').expect(400);
      await t.http().get('/api/v1/deal-requests/target-agencies?pageSize=500').expect(400);
    });
  });

  // ------------------------------------------------------------------ address match

  describe('GET /api/v1/deal-requests/address-match', () => {
    it('200: complex by road name + number (any 시도 spelling) with area types and market', async () => {
      await regions();
      const c = await createComplex(t.prisma, {
        name: '신대 레이크파크 1단지',
        roadAddress: '전남광주통합특별시 순천시 해룡면 신대2로 40',
        emdCode: '1215031022',
        households: 1412,
        builtYear: 2019,
        floorsMax: 25,
        lat: 34.9372,
        lng: 127.5512,
      });
      const at = await t.prisma.complexAreaType.create({
        data: { complexId: c.id, exclusiveArea: '84.98', supplyArea: '112.40', typeName: '84A' },
      });
      await t.prisma.complexAreaType.create({
        data: { complexId: c.id, exclusiveArea: '59.92', pyeongLabel: '25평' },
      });
      await t.prisma.tradeRecord.createMany({
        data: [
          {
            sourceKey: 'k1',
            kind: 'APT_TRADE',
            complexId: c.id,
            areaTypeId: at.id,
            sggCode: '12150',
            aptName: c.name,
            dealType: 'SALE',
            dealDate: new Date('2026-10-12'),
            dealYm: 202610,
            exclusiveArea: '84.98',
            price: 43500,
          },
          {
            sourceKey: 'k2',
            kind: 'APT_TRADE',
            complexId: c.id,
            sggCode: '12150',
            aptName: c.name,
            dealType: 'SALE',
            dealDate: new Date('2026-11-01'),
            dealYm: 202611,
            exclusiveArea: '84.98',
            price: 10,
            cancelled: true,
          },
        ],
      });
      const b = await broker(t);
      for (const salePrice of [39000, 48500]) {
        await createListing(t.prisma, {
          agencyId: b.agency.id,
          property: { complexId: c.id },
          listing: { salePrice },
        });
      }

      const res = await t
        .http()
        .get('/api/v1/deal-requests/address-match')
        .query({ roadAddress: '전남 순천시 해룡면 신대2로 40', bcode: '4615031022' })
        .expect(200);
      expect(res.body).toEqual({
        emdCode: '1215031022',
        emdName: '해룡면 신대리',
        lat: 34.9372,
        lng: 127.5512,
        complex: {
          id: c.id,
          name: '신대 레이크파크 1단지',
          emdName: '해룡면 신대리',
          households: 1412,
          builtYear: 2019,
          floorsMax: 25,
          areaTypes: [
            expect.objectContaining({
              pyeongLabel: '25평',
              exclusiveArea: 59.92,
              supplyArea: null,
            }),
            { id: at.id, pyeongLabel: '34평', exclusiveArea: 84.98, supplyArea: 112.4 },
          ],
          market: {
            recentTradePrice: 43500,
            recentTradeYm: '2026-10',
            recentTradePyeong: '34평',
            askingMin: 39000,
            askingMax: 48500,
            perPyeong: 1279,
          },
        },
      });
    });

    it('200: falls back to the building name within the 읍면동; no match → bcode + name only', async () => {
      await regions();
      const c = await createComplex(t.prisma, {
        name: '연향 센트럴',
        roadAddress: null,
        emdCode: YEONHYANG,
      });
      const byName = await t
        .http()
        .get('/api/v1/deal-requests/address-match')
        .query({
          roadAddress: '전남 순천시 연향3로 20',
          buildingName: '연향센트럴',
          bcode: YEONHYANG,
        })
        .expect(200);
      expect(byName.body.complex).toMatchObject({ id: c.id, market: null, areaTypes: [] });

      const none = await t
        .http()
        .get('/api/v1/deal-requests/address-match')
        .query({ roadAddress: '전남 순천시 조례1길 7', bcode: '4615013300' })
        .expect(200);
      expect(none.body).toEqual({
        emdCode: JORYE,
        emdName: '조례동',
        lat: null,
        lng: null,
        complex: null,
      });
    });

    it('400 without a road address or with a malformed bcode', async () => {
      const res = await t.http().get('/api/v1/deal-requests/address-match').expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      await t
        .http()
        .get('/api/v1/deal-requests/address-match')
        .query({ roadAddress: '중앙로 1', bcode: 'x' })
        .expect(400);
    });
  });

  // ------------------------------------------------------------------ listing candidates

  describe('GET /api/v1/agency/deal-requests/:id/listing-candidates', () => {
    it('200: own ACTIVE listings (incl. co-brokered), best match first, inbox listing shape', async () => {
      await regions();
      const b = await broker(t);
      const other = await broker(t);
      const { user } = await requester(t);
      const req = await dealRequest(t.prisma, user.id, {
        type: DealRequestType.WANTED,
        assetType: AssetType.APT,
        dealTypes: [DealType.JEONSE],
        roadAddress: null,
        addressDetail: null,
        desiredSalePrice: null,
        regionCodes: [JORYE],
        depositMin: 20000,
        depositMax: 30000,
      });
      const { listing: sale } = await createListing(t.prisma, {
        agencyId: b.agency.id,
        property: { emdCode: JORYE },
        listing: { title: '조례 매매', verifiedAt: new Date() },
      });
      const { listing: jeonse } = await createListing(t.prisma, {
        agencyId: b.agency.id,
        property: { emdCode: JORYE },
        listing: {
          title: '조례 전세',
          dealType: DealType.JEONSE,
          salePrice: null,
          deposit: 28000,
          verifiedAt: new Date(Date.now() - 20 * DAY),
        },
      });
      const { listing: co } = await createListing(t.prisma, {
        agencyId: other.agency.id,
        listing: {
          title: '공동중개 전세',
          dealType: DealType.JEONSE,
          salePrice: null,
          deposit: 50000,
        },
      });
      await t.prisma.listingAgency.create({
        data: { listingId: co.id, agencyId: b.agency.id, isPrimary: false },
      });
      const { listing: left } = await createListing(t.prisma, { agencyId: other.agency.id });
      await t.prisma.listingAgency.create({
        data: {
          listingId: left.id,
          agencyId: b.agency.id,
          isPrimary: false,
          status: ListingAgencyStatus.WITHDRAWN,
        },
      });
      await createListing(t.prisma, {
        agencyId: b.agency.id,
        listing: { status: ListingStatus.RESERVED },
      });
      await createListing(t.prisma, { agencyId: other.agency.id });

      const res = await withSession(
        t.http().get(`/api/v1/agency/deal-requests/${req.id}/listing-candidates`),
        b.s,
      ).expect(200);
      expect(res.body).toMatchObject({ total: 3, page: 1, pageSize: 50, totalPages: 1 });
      // jeonse: every condition; sale and co tie on 2 → incoming order (latest 실매물 확인 first).
      expect(itemIds(res.body)).toEqual([jeonse.id, sale.id, co.id]);
      expect(res.body.items[0]).toEqual({
        id: jeonse.id,
        title: '조례 전세',
        assetType: 'APT',
        dealType: 'JEONSE',
        price: 28000,
        deposit: null,
        monthlyRent: null,
        exclusiveArea: 84.97,
        floorLabel: '5/15층',
        rooms: 3,
        emdCode: JORYE,
        emdName: '조례동',
        complexId: null,
        thumbUrl: null,
        verifiedAt: jeonse.verifiedAt!.toISOString(),
      });

      const q = await withSession(
        t.http().get(`/api/v1/agency/deal-requests/${req.id}/listing-candidates?q=공동&pageSize=1`),
        b.s,
      ).expect(200);
      expect(itemIds(q.body)).toEqual([co.id]);
      expect(q.body.totalPages).toBe(1);
    });

    it('AGENT 200; 404 for a request the agency cannot see; 403 USER; 401; 400 bad id', async () => {
      const b = await broker(t);
      const a = await agent(t, b.agency);
      const otherB = await broker(t);
      const { user, s } = await requester(t);
      const visible = await dealRequest(t.prisma, user.id);
      const hidden = await dealRequest(t.prisma, user.id, {
        visibility: DealRequestVisibility.SELECTED_AGENCIES,
      });
      await t.prisma.dealRequestTarget.create({
        data: { dealRequestId: hidden.id, agencyId: otherB.agency.id },
      });
      const closed = await dealRequest(t.prisma, user.id, { status: DealRequestStatus.CLOSED });
      const url = (id: string) => `/api/v1/agency/deal-requests/${id}/listing-candidates`;
      await withSession(t.http().get(url(visible.id)), a.s).expect(200);
      const nf = await withSession(t.http().get(url(hidden.id)), b.s).expect(404);
      expect(nf.body.code).toBe('DEAL_REQUEST_NOT_FOUND');
      await withSession(t.http().get(url(closed.id)), b.s).expect(404);
      await withSession(t.http().get(url(visible.id)), s).expect(403);
      await t.http().get(url(visible.id)).expect(401);
      await withSession(t.http().get(url('nope')), b.s).expect(400);
    });
  });

  // ------------------------------------------------------------------ B5 notifications

  describe('B5: notification audience', () => {
    it('agency events carry data.agencyId (accept, contact grant); the requester’s do not', async () => {
      const b = await broker(t);
      const a = await agent(t, b.agency);
      const { user, s } = await requester(t);
      const req = await dealRequest(t.prisma, user.id);
      const p = await proposal(t.prisma, req.id, b.agency.id);
      await withSession(t.http().post(`/api/v1/me/proposals/${p.id}/accept`), s)
        .send({ shareContact: false })
        .expect(200);
      await withSession(t.http().post(`/api/v1/me/deal-requests/${req.id}/contact-grants`), s)
        .send({ agencyId: b.agency.id })
        .expect(201);
      for (const userId of [b.user.id, a.user.id]) {
        const rows = await t.prisma.notification.findMany({ where: { userId } });
        expect(rows.map((r) => r.type).sort()).toEqual(
          [NotificationType.CONTACT_GRANTED, NotificationType.PROPOSAL_ACCEPTED].sort(),
        );
        for (const r of rows) expect(r.data).toMatchObject({ agencyId: b.agency.id });
      }

      // Proposal → requester notification stays personal.
      const req2 = await dealRequest(t.prisma, user.id);
      await withSession(t.http().post(`/api/v1/agency/deal-requests/${req2.id}/proposals`), b.s)
        .send({ message: '좋은 매물이 있습니다.', listingIds: [] })
        .expect(201);
      const mine = await t.prisma.notification.findFirstOrThrow({ where: { userId: user.id } });
      expect(mine.type).toBe(NotificationType.PROPOSAL_RECEIVED);
      expect(mine.data).not.toHaveProperty('agencyId');
    });

    it('listing notices written with createFor get the primary agency id', async () => {
      const b = await broker(t);
      const { listing } = await createListing(t.prisma, { agencyId: b.agency.id });
      const svc = t.app.get(NotificationsService);
      await svc.createFor([b.user.id], {
        type: NotificationType.LISTING_HIDDEN,
        title: '매물이 숨김 처리되었습니다.',
        data: { listingId: listing.id },
      });
      const row = await t.prisma.notification.findFirstOrThrow({ where: { userId: b.user.id } });
      expect(row.data).toEqual({ listingId: listing.id, agencyId: b.agency.id });
    });

    it('GET /me/notifications?scope + unreadCount, unread-count?scope, read all within a scope', async () => {
      const broker1 = await broker(t);
      const userId = broker1.user.id;
      const mk = (type: NotificationType, data: object | null, i: number, read = false) =>
        t.prisma.notification.create({
          data: {
            userId,
            type,
            title: `알림 ${i}`,
            data: data ?? undefined,
            readAt: read ? new Date() : null,
            createdAt: new Date(Date.UTC(2026, 10, 1, 0, 0, i)),
          },
        });
      const agency1 = await mk(NotificationType.SYSTEM, { agencyId: broker1.agency.id }, 1);
      // Agency-only type without agencyId (e.g. the listings module's direct write).
      const agency2 = await mk(NotificationType.LISTING_EXPIRED, { listingId: 'x' }, 2);
      const agency3 = await mk(NotificationType.DEAL_REQUEST_RECEIVED, null, 3, true);
      const personal1 = await mk(NotificationType.PROPOSAL_RECEIVED, { dealRequestId: 'r' }, 4);
      const personal2 = await mk(NotificationType.SYSTEM, null, 5);
      await mk(NotificationType.SYSTEM, null, 6);
      const s = broker1.s;
      const ids = (body: unknown) => itemIds(body);

      const all = await withSession(t.http().get('/api/v1/me/notifications'), s).expect(200);
      expect(all.body.items).toHaveLength(6);
      expect(all.body.unreadCount).toBe(5);

      const ag = await withSession(t.http().get('/api/v1/me/notifications?scope=agency'), s).expect(
        200,
      );
      expect(ids(ag.body)).toEqual([agency3.id, agency2.id, agency1.id]);
      expect(ag.body.unreadCount).toBe(2);
      const pe = await withSession(
        t.http().get('/api/v1/me/notifications?scope=personal&unreadOnly=true'),
        s,
      ).expect(200);
      expect(ids(pe.body)).toEqual(expect.arrayContaining([personal1.id, personal2.id]));
      expect(pe.body.items).toHaveLength(3);
      expect(pe.body.unreadCount).toBe(3);

      const count = await withSession(
        t.http().get('/api/v1/me/notifications/unread-count?scope=agency'),
        s,
      ).expect(200);
      expect(count.body).toEqual({ unread: 2 });

      const read = await withSession(t.http().post('/api/v1/me/notifications/read?scope=agency'), s)
        .send({ all: true })
        .expect(200);
      expect(read.body).toEqual({ updated: 2, unread: 0 });
      const left = await withSession(
        t.http().get('/api/v1/me/notifications/unread-count'),
        s,
      ).expect(200);
      expect(left.body).toEqual({ unread: 3 });

      await withSession(t.http().get('/api/v1/me/notifications?scope=team'), s).expect(400);
      await withSession(t.http().get('/api/v1/me/notifications/unread-count?scope=x'), s).expect(
        400,
      );
    });
  });
});
