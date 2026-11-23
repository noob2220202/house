import { DealType, ErrorCode, ListingStatus, MediaPurpose } from '@house/shared';
import { TradeStatsService } from '../../../src/modules/complexes/trade-sync/trade-stats.service';
import {
  createAgency,
  createComplex,
  createListing,
  createMedia,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import {
  createComplexesApp,
  FakeTradeApi,
  insertTrade,
  NIL_UUID,
  seedBuyoung,
  seedRegions,
} from './helpers';

const d = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

describe('complexes: public read API (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createComplexesApp(new FakeTradeApi());
  });
  beforeEach(async () => {
    await resetAll(t);
    await seedRegions(t);
  });
  afterAll(() => t?.close());

  async function seedSearchSet() {
    const { complex: buyoung } = await seedBuyoung(t, { viewCount: 50 });
    const ecs = await createComplex(t.prisma, {
      name: 'e편한세상 순천조례',
      roadAddress: '전라남도 순천시 조례로 10',
      emdCode: '46150133',
      emdName: '조례동',
      households: 1200,
      approvalDate: d('2019-03-01'),
      viewCount: 10,
    });
    const gone = await createComplex(t.prisma, { name: '철거부영', deletedAt: new Date() });
    const elsewhere = await createComplex(t.prisma, { name: '여수부영', sggCode: '46130' });
    return { buyoung, ecs, gone, elsewhere };
  }

  describe('GET /complexes', () => {
    it('searches by name/address (trigram ILIKE) and 초성 within the service 시군구', async () => {
      const { buyoung, ecs } = await seedSearchSet();
      const byName = await t.http().get('/api/v1/complexes?q=부영').expect(200);
      expect(byName.body).toMatchObject({ total: 1, page: 1, pageSize: 20, totalPages: 1 });
      expect(byName.body.items[0]).toMatchObject({
        id: buyoung.id,
        name: '연향부영3차',
        emdCode: '46150114',
        households: 600,
        approvalDate: '1998-05-20',
      });
      const byAddr = await t.http().get('/api/v1/complexes?q=조례로').expect(200);
      expect((byAddr.body.items as { id: string }[]).map((c) => c.id)).toEqual([ecs.id]);
      const chosung = await t
        .http()
        .get(`/api/v1/complexes?q=${encodeURIComponent('ㅂㅇ3')}`)
        .expect(200);
      expect((chosung.body.items as { id: string }[]).map((c) => c.id)).toEqual([buyoung.id]);
      const like = await t
        .http()
        .get(`/api/v1/complexes?q=${encodeURIComponent('%')}`)
        .expect(200);
      expect(like.body.total).toBe(0);
    });

    it('filters by 읍면동, sorts and paginates; deleted and out-of-region 단지 never appear', async () => {
      const { buyoung, ecs } = await seedSearchSet();
      const all = await t.http().get('/api/v1/complexes').expect(200);
      expect((all.body.items as { id: string }[]).map((c) => c.id)).toEqual([buyoung.id, ecs.id]); // by views
      const emd = await t.http().get('/api/v1/complexes?emdCode=46150133').expect(200);
      expect((emd.body.items as { id: string }[]).map((c) => c.id)).toEqual([ecs.id]);
      const newest = await t
        .http()
        .get('/api/v1/complexes?sort=newest&pageSize=1&page=1')
        .expect(200);
      expect(newest.body).toMatchObject({ total: 2, totalPages: 2 });
      expect(newest.body.items[0].id).toBe(ecs.id);
      const households = await t.http().get('/api/v1/complexes?sort=households').expect(200);
      expect(households.body.items[0].id).toBe(ecs.id);
    });

    it('400 on invalid queries', async () => {
      await t
        .http()
        .get(`/api/v1/complexes?q=${'가'.repeat(51)}`)
        .expect(400);
      await t.http().get('/api/v1/complexes?emdCode=461501').expect(400);
      await t.http().get('/api/v1/complexes?sort=price').expect(400);
      const r = await t.http().get('/api/v1/complexes?pageSize=1000').expect(400);
      expect(r.body.code).toBe(ErrorCode.VALIDATION_FAILED);
    });
  });

  describe('GET /complexes/autocomplete', () => {
    it('suggests 읍면동/리 and 단지 (also by 초성)', async () => {
      const { buyoung, ecs } = await seedSearchSet();
      const r = await t
        .http()
        .get(`/api/v1/complexes/autocomplete?q=${encodeURIComponent('연향')}`)
        .expect(200);
      expect(r.body.regions[0]).toMatchObject({ code: '46150114', name: '연향동', level: 'EMD' });
      expect(r.body.complexes).toEqual([
        expect.objectContaining({ id: buyoung.id, name: '연향부영3차', emdName: '연향동' }),
      ]);
      const cho = await t
        .http()
        .get(`/api/v1/complexes/autocomplete?q=${encodeURIComponent('ㅈㄹ')}`)
        .expect(200);
      expect((cho.body.regions as { name: string }[]).map((x) => x.name)).toContain('조례동');
      expect((cho.body.complexes as { id: string }[]).map((x) => x.id)).toEqual([ecs.id]);
      const ri = await t
        .http()
        .get(`/api/v1/complexes/autocomplete?q=${encodeURIComponent('신대리')}`)
        .expect(200);
      expect(ri.body.regions[0]).toMatchObject({
        code: '4615031022',
        level: 'RI',
        fullName: '전라남도 순천시 해룡면 신대리',
      });
    });

    it('400 without q or with a bad limit', async () => {
      await t.http().get('/api/v1/complexes/autocomplete').expect(400);
      await t.http().get('/api/v1/complexes/autocomplete?q=a&limit=99').expect(400);
    });
  });

  describe('GET /complexes/popular', () => {
    it('ranks by deduped recent views, tops up by all-time views, with listing counts', async () => {
      const a = await createComplex(t.prisma, { name: '인기A' });
      const b = await createComplex(t.prisma, { name: '인기B' });
      const c = await createComplex(t.prisma, { name: '조용C', viewCount: 5 });
      await createComplex(t.prisma, { name: '조용D', viewCount: 1 });
      const view = (id: string, ua: string) =>
        t.http().get(`/api/v1/complexes/${id}`).set('User-Agent', ua).expect(200);
      await view(a.id, 'ua-1');
      await view(a.id, 'ua-1'); // same viewer, same day → counted once
      await view(a.id, 'ua-2');
      await view(b.id, 'ua-1');

      const { agency } = await createAgency(t.prisma);
      await createListing(t.prisma, { agencyId: agency.id, property: { complexId: a.id } });
      await createListing(t.prisma, { agencyId: agency.id, property: { complexId: a.id } });
      await createListing(t.prisma, {
        agencyId: agency.id,
        property: { complexId: a.id },
        listing: { dealType: DealType.JEONSE, salePrice: null, deposit: 15000, priceSort: 15000 },
      });
      await createListing(t.prisma, {
        agencyId: agency.id,
        property: { complexId: a.id },
        listing: { status: ListingStatus.DRAFT },
      });

      const r = await t.http().get('/api/v1/complexes/popular?limit=3').expect(200);
      expect((r.body as { id: string }[]).map((x) => x.id)).toEqual([a.id, b.id, c.id]);
      expect(r.body[0]).toMatchObject({
        rank: 1,
        score: 2,
        listingCounts: { total: 3, byDealType: { SALE: 2, JEONSE: 1, MONTHLY: 0, PRESALE: 0 } },
      });
      expect(r.body[2]).toMatchObject({ rank: 3, score: 0 });
    });

    it('400 for an out-of-range limit', async () => {
      await t.http().get('/api/v1/complexes/popular?limit=0').expect(400);
      await t.http().get('/api/v1/complexes/popular?limit=51').expect(400);
      await t.http().get('/api/v1/complexes/popular?emdCode=x').expect(400);
    });
  });

  describe('GET /complexes/:id', () => {
    it('returns detail with 평형, photos, latest trades, listing summary and favorite flag', async () => {
      const { complex, at84, at59 } = await seedBuyoung(t);
      const media = await createMedia(t.prisma, {
        purpose: MediaPurpose.COMPLEX_PHOTO,
        storageKey: 'c/a.webp',
        variants: { thumb: { key: 'c/a-thumb.webp' } },
      });
      await t.prisma.complexPhoto.create({
        data: { complexId: complex.id, mediaId: media.id, caption: '정문' },
      });
      await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at84.id,
        price: 18000,
        dealDate: d('2024-09-01'),
      });
      const latest = await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at84.id,
        price: 18800,
        dealDate: d('2024-10-20'),
      });
      await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at84.id,
        price: 99999,
        dealDate: d('2024-10-25'),
        cancelled: true,
      });
      await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at59.id,
        price: 15000,
        exclusiveArea: '59.84',
        dealDate: d('2024-08-01'),
      });
      const { agency } = await createAgency(t.prisma);
      await createListing(t.prisma, {
        agencyId: agency.id,
        property: { complexId: complex.id },
        listing: { salePrice: 21000, priceSort: 21000 },
      });

      const r = await t.http().get(`/api/v1/complexes/${complex.id}`).expect(200);
      expect(r.body).toMatchObject({
        id: complex.id,
        name: '연향부영3차',
        approvalYear: 1998,
        households: 600,
        region: { code: '46150114', name: '연향동', fullName: '전라남도 순천시 연향동' },
        isFavorite: false,
        viewCount: 1,
        photos: [
          {
            mediaId: media.id,
            thumbUrl: '/media/c/a-thumb.webp',
            largeUrl: '/media/c/a.webp',
            caption: '정문',
          },
        ],
      });
      expect(r.body.areaTypes).toEqual([
        expect.objectContaining({
          id: at59.id,
          exclusiveArea: 59.84,
          supplyArea: 79.3,
          pyeongLabel: '24평',
          exclusivePyeong: 18.1,
        }),
        expect.objectContaining({
          id: at84.id,
          exclusiveArea: 84.97,
          pyeongLabel: '34평',
          typeName: '84A',
        }),
      ]);
      expect((r.body.latestTrades as { id: string }[]).map((x) => x.id)).toEqual(
        expect.arrayContaining([latest.id]),
      );
      expect(r.body.latestTrades).toHaveLength(2);
      const sale = (r.body.listingSummary.byDealType as { dealType: string }[]).find(
        (x) => x.dealType === 'SALE',
      );
      expect(sale).toMatchObject({ count: 1, minPrice: 21000, maxPrice: 21000 });
      expect(r.body).not.toHaveProperty('externalCode');
      expect(r.body).not.toHaveProperty('jibun');
    });

    it('personalizes for a logged-in user (favorite + 최근 본 단지)', async () => {
      const { complex } = await seedBuyoung(t);
      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      await t.prisma.favoriteComplex.create({ data: { userId: user.id, complexId: complex.id } });
      const r = await withSession(t.http().get(`/api/v1/complexes/${complex.id}`), s).expect(200);
      expect(r.body.isFavorite).toBe(true);
      const recent = await t.prisma.recentView.findMany({ where: { userId: user.id } });
      expect(recent).toEqual([
        expect.objectContaining({ targetType: 'COMPLEX', targetId: complex.id }),
      ]);
    });

    it('404 for deleted/unknown 단지, 400 for a malformed id', async () => {
      const gone = await createComplex(t.prisma, { deletedAt: new Date() });
      const r = await t.http().get(`/api/v1/complexes/${gone.id}`).expect(404);
      expect(r.body.code).toBe(ErrorCode.COMPLEX_NOT_FOUND);
      await t.http().get(`/api/v1/complexes/${NIL_UUID}`).expect(404);
      await t.http().get('/api/v1/complexes/not-a-uuid').expect(400);
    });
  });

  describe('GET /complexes/:id/trades', () => {
    it('lists trades newest first with filters; 해제 hidden unless requested', async () => {
      const { complex, at84, at59 } = await seedBuyoung(t);
      const s1 = await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at84.id,
        dealDate: d('2024-08-03'),
      });
      const s2 = await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at84.id,
        dealDate: d('2024-10-03'),
      });
      const cancelled = await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at84.id,
        dealDate: d('2024-10-10'),
        cancelled: true,
        cancelledAt: d('2024-10-30'),
      });
      const rent = await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at59.id,
        kind: 'APT_RENT',
        dealType: 'MONTHLY',
        price: null,
        deposit: 2000,
        monthlyRent: 45,
        exclusiveArea: '59.84',
        dealDate: d('2024-09-15'),
      });
      const base = `/api/v1/complexes/${complex.id}/trades`;
      const all = await t.http().get(base).expect(200);
      expect((all.body.items as { id: string }[]).map((x) => x.id)).toEqual([
        s2.id,
        rent.id,
        s1.id,
      ]);
      expect(all.body.items[1]).toMatchObject({
        dealType: 'MONTHLY',
        deposit: 2000,
        monthlyRent: 45,
        exclusivePyeong: 18.1,
      });
      const withCancelled = await t.http().get(`${base}?includeCancelled=true`).expect(200);
      expect(withCancelled.body.items[0]).toMatchObject({
        id: cancelled.id,
        cancelled: true,
        cancelledAt: '2024-10-30',
      });
      const sales = await t
        .http()
        .get(`${base}?dealType=SALE&fromYm=202409&toYm=202412`)
        .expect(200);
      expect((sales.body.items as { id: string }[]).map((x) => x.id)).toEqual([s2.id]);
      const byArea = await t.http().get(`${base}?areaTypeId=${at59.id}`).expect(200);
      expect(byArea.body.total).toBe(1);
    });

    it('404 for an unknown 단지, 400 for invalid filters', async () => {
      await t.http().get(`/api/v1/complexes/${NIL_UUID}/trades`).expect(404);
      const { complex } = await seedBuyoung(t);
      const base = `/api/v1/complexes/${complex.id}/trades`;
      await t.http().get(`${base}?fromYm=202412&toYm=202401`).expect(400);
      await t.http().get(`${base}?fromYm=202413`).expect(400);
      await t.http().get(`${base}?dealType=PRESALE`).expect(400);
      await t.http().get(`${base}?areaTypeId=x`).expect(400);
    });
  });

  describe('GET /complexes/:id/stats', () => {
    it('returns monthly trends per 평형 and overall, plus the latest trade per 평형', async () => {
      const { complex, at84, at59 } = await seedBuyoung(t);
      await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at84.id,
        price: 18000,
        dealDate: d('2024-09-01'),
      });
      await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at84.id,
        price: 19000,
        dealDate: d('2024-09-20'),
      });
      await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at84.id,
        price: 20000,
        dealDate: d('2024-09-25'),
      });
      await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at84.id,
        price: 19500,
        exclusiveArea: '84.98',
        dealDate: d('2024-10-02'),
      });
      await insertTrade(t, {
        complexId: complex.id,
        areaTypeId: at59.id,
        price: 15000,
        exclusiveArea: '59.84',
        dealDate: d('2024-10-05'),
      });
      await t.app.get(TradeStatsService).recompute([complex.id]);

      const r = await t.http().get(`/api/v1/complexes/${complex.id}/stats?months=12`).expect(200);
      expect(r.body).toMatchObject({
        complexId: complex.id,
        dealType: 'SALE',
        fromYm: 202311,
        toYm: 202410,
      });
      expect(r.body.series).toEqual([
        {
          exclusiveArea: 59.84,
          exclusivePyeong: 18.1,
          areaTypeId: at59.id,
          pyeongLabel: '24평',
          points: [
            expect.objectContaining({ yearMonth: 202410, tradeCount: 1, medianPrice: 15000 }),
          ],
        },
        expect.objectContaining({
          areaTypeId: at84.id,
          points: [
            {
              yearMonth: 202409,
              tradeCount: 3,
              medianPrice: 19000,
              minPrice: 18000,
              maxPrice: 20000,
              avgPrice: 19000,
              medianMonthlyRent: null,
            },
            expect.objectContaining({ yearMonth: 202410, tradeCount: 1, medianPrice: 19500 }),
          ],
        }),
      ]);
      expect(r.body.overall).toEqual([
        expect.objectContaining({ yearMonth: 202409, tradeCount: 3, medianPrice: 19000 }),
        expect.objectContaining({ yearMonth: 202410, tradeCount: 2, medianPrice: 17250 }),
      ]);
      expect((r.body.latest as { price: number }[]).map((x) => x.price).sort()).toEqual([
        15000, 19500,
      ]);

      const one = await t
        .http()
        .get(`/api/v1/complexes/${complex.id}/stats?areaTypeId=${at59.id}`)
        .expect(200);
      expect(one.body.series).toHaveLength(1);
      expect(one.body.latest).toEqual([expect.objectContaining({ price: 15000 })]);

      const empty = await t
        .http()
        .get(`/api/v1/complexes/${complex.id}/stats?dealType=JEONSE`)
        .expect(200);
      expect(empty.body).toMatchObject({ toYm: null, series: [], overall: [], latest: [] });
    });

    it('404 for unknown 단지 or a foreign 평형, 400 for invalid params', async () => {
      const { complex } = await seedBuyoung(t);
      const other = await seedBuyoung(t, { name: '다른단지', externalCode: null });
      await t.http().get(`/api/v1/complexes/${NIL_UUID}/stats`).expect(404);
      const r = await t
        .http()
        .get(`/api/v1/complexes/${complex.id}/stats?areaTypeId=${other.at84.id}`)
        .expect(404);
      expect(r.body.code).toBe(ErrorCode.COMPLEX_AREA_TYPE_NOT_FOUND);
      await t.http().get(`/api/v1/complexes/${complex.id}/stats?months=0`).expect(400);
      await t.http().get(`/api/v1/complexes/${complex.id}/stats?dealType=X`).expect(400);
    });
  });

  describe('GET /complexes/:id/listings', () => {
    it('summarizes active listings per deal type', async () => {
      const { complex } = await seedBuyoung(t);
      const { agency } = await createAgency(t.prisma);
      const make = (listing: object) =>
        createListing(t.prisma, {
          agencyId: agency.id,
          property: { complexId: complex.id },
          listing,
        });
      await make({ salePrice: 20000, priceSort: 20000 });
      await make({ salePrice: 23000, priceSort: 23000, status: ListingStatus.RESERVED });
      await make({ salePrice: 1, priceSort: 1, status: ListingStatus.HIDDEN });
      await make({
        dealType: DealType.MONTHLY,
        salePrice: null,
        deposit: 1000,
        monthlyRent: 50,
        priceSort: 1000,
      });
      await make({
        dealType: DealType.MONTHLY,
        salePrice: null,
        deposit: 500,
        monthlyRent: 70,
        priceSort: 500,
      });

      const r = await t.http().get(`/api/v1/complexes/${complex.id}/listings`).expect(200);
      expect(r.body.total).toBe(4);
      expect(r.body.byDealType).toEqual([
        {
          dealType: 'SALE',
          count: 2,
          minPrice: 20000,
          maxPrice: 23000,
          minMonthlyRent: null,
          maxMonthlyRent: null,
        },
        {
          dealType: 'JEONSE',
          count: 0,
          minPrice: null,
          maxPrice: null,
          minMonthlyRent: null,
          maxMonthlyRent: null,
        },
        {
          dealType: 'MONTHLY',
          count: 2,
          minPrice: 500,
          maxPrice: 1000,
          minMonthlyRent: 50,
          maxMonthlyRent: 70,
        },
        {
          dealType: 'PRESALE',
          count: 0,
          minPrice: null,
          maxPrice: null,
          minMonthlyRent: null,
          maxMonthlyRent: null,
        },
      ]);
    });

    it('404 for deleted 단지, 400 for a malformed id', async () => {
      const gone = await createComplex(t.prisma, { deletedAt: new Date() });
      await t.http().get(`/api/v1/complexes/${gone.id}/listings`).expect(404);
      await t.http().get('/api/v1/complexes/123/listings').expect(400);
    });
  });

  describe('GET /regions', () => {
    it('lists 읍면동 of the service 시군구 by default, 리 by parent, and one region by code', async () => {
      const emd = await t.http().get('/api/v1/regions').expect(200);
      expect(emd.body).toHaveLength(44);
      expect(emd.body[0]).toMatchObject({
        code: '46150101',
        name: '삼거동',
        level: 'EMD',
        parentCode: '46150',
      });
      const ri = await t.http().get('/api/v1/regions?parentCode=46150310').expect(200);
      expect((ri.body as { name: string }[]).map((r) => r.name)).toContain('신대리');
      const sgg = await t.http().get('/api/v1/regions?level=SGG').expect(200);
      expect(sgg.body).toEqual([expect.objectContaining({ code: '46150', name: '순천시' })]);
      const one = await t.http().get('/api/v1/regions/46150133').expect(200);
      expect(one.body).toMatchObject({ name: '조례동', fullName: '전라남도 순천시 조례동' });
    });

    it('hides inactive regions unless asked; 404 unknown code; 400 malformed', async () => {
      await t.prisma.region.update({ where: { code: '46150101' }, data: { isActive: false } });
      const active = await t.http().get('/api/v1/regions').expect(200);
      expect(active.body).toHaveLength(43);
      const all = await t.http().get('/api/v1/regions?includeInactive=true').expect(200);
      expect(all.body).toHaveLength(44);
      expect((await t.http().get('/api/v1/regions/46150999').expect(404)).body.code).toBe(
        ErrorCode.REGION_NOT_FOUND,
      );
      await t.http().get('/api/v1/regions/abc').expect(400);
      await t.http().get('/api/v1/regions?level=CITY').expect(400);
    });
  });
});
