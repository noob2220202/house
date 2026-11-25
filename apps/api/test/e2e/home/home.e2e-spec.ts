import { AgencyStatus, AssetType, DealType, ListingStatus, kstDayKey } from '@house/shared';
import {
  createAgency,
  createListing,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import { createHomeApp, JORYE, seedRegions, YEONHYANG, YEONHYANG_10 } from './helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('home: summary + popular regions (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createHomeApp();
  });
  beforeEach(async () => {
    await resetAll(t);
    await seedRegions(t);
  });
  afterAll(() => t?.close());

  /** 연향동: 아파트 매매 (10-digit code, verified now) + 원룸 월세; 조례동: 토지 매매. */
  async function seedListings() {
    const { agency } = await createAgency(t.prisma);
    const apt = await createListing(t.prisma, {
      agencyId: agency.id,
      property: { emdCode: YEONHYANG_10, supplyArea: '112.40', lat: 34.95, lng: 127.52 },
      listing: { verifiedAt: new Date() },
    });
    const oneroom = await createListing(t.prisma, {
      agencyId: agency.id,
      property: { assetType: AssetType.ONEROOM, emdCode: YEONHYANG, lat: 34.952, lng: 127.522 },
      listing: {
        dealType: DealType.MONTHLY,
        salePrice: null,
        deposit: 500,
        monthlyRent: 40,
        priceSort: 500,
      },
    });
    const land = await createListing(t.prisma, {
      agencyId: agency.id,
      property: {
        assetType: AssetType.LAND,
        emdCode: JORYE,
        landArea: '330.58',
        exclusiveArea: null,
        lat: 34.96,
        lng: 127.53,
      },
      listing: { salePrice: 10_000, priceSort: 10_000 },
    });
    // Not public: a draft, and an ad of a suspended office.
    await createListing(t.prisma, {
      agencyId: agency.id,
      property: { emdCode: JORYE },
      listing: { status: ListingStatus.DRAFT },
    });
    const { agency: suspended } = await createAgency(t.prisma, { status: AgencyStatus.SUSPENDED });
    await createListing(t.prisma, { agencyId: suspended.id, property: { emdCode: JORYE } });
    return { agency, apt: apt.listing, oneroom: oneroom.listing, land: land.listing };
  }

  describe('GET /home/summary', () => {
    it('counts public listings, approved offices and 지역 with names and 평당가', async () => {
      await seedListings();
      const res = await t.http().get('/api/v1/home/summary').expect(200);
      expect(res.body).toMatchObject({
        regionName: '순천시',
        listingCount: 3,
        agencyCount: 1,
        verifiedTodayCount: 1,
        assetTypeCounts: {
          APT: 1,
          OFFICETEL: 0,
          ONEROOM: 1,
          HOUSE: 0,
          COMMERCIAL: 0,
          LAND: 1,
        },
      });
      expect(typeof res.body.updatedAt).toBe('string');
      expect(res.body.regions).toEqual([
        {
          code: YEONHYANG,
          name: '연향동',
          emdName: '연향동',
          // The region's own point (verified list), not the listings' mean position.
          lat: 34.939582,
          lng: 127.521019,
          listingCount: 2,
          // 30,000만원 / (112.4㎡ / 3.305785) ≈ 882만원/평 (공급 평당).
          avgPricePerPyeong: 882,
        },
        {
          code: JORYE,
          name: '조례동',
          emdName: '조례동',
          lat: 34.961766,
          lng: 127.523528,
          listingCount: 1,
          avgPricePerPyeong: null,
        },
      ]);
    });

    it('never shows a raw code as a region name (the live 12150133 bug)', async () => {
      const { agency } = await createAgency(t.prisma);
      // 조례동 without a regions row (the table still held the sample rows), named from the
      // bundled verified list; a code nothing can name is left out of the 지역 list.
      await t.prisma.region.delete({ where: { code: JORYE } });
      await createListing(t.prisma, {
        agencyId: agency.id,
        property: { emdCode: JORYE, lat: 34.9618, lng: 127.5235 },
      });
      await createListing(t.prisma, {
        agencyId: agency.id,
        property: { emdCode: '12150999', lat: 34.95, lng: 127.5 },
      });
      const res = await t.http().get('/api/v1/home/summary').expect(200);
      expect(res.body.listingCount).toBe(2);
      expect(res.body.regions).toEqual([
        expect.objectContaining({
          code: JORYE,
          name: '조례동',
          emdName: '조례동',
          listingCount: 1,
        }),
      ]);
      for (const r of res.body.regions as { name: string }[]) expect(r.name).not.toMatch(/^\d+$/);

      const popular = await t.http().get('/api/v1/home/popular-regions').expect(200);
      expect(popular.body.items).toEqual([
        expect.objectContaining({ rank: 1, code: JORYE, name: '조례동' }),
      ]);
    });

    it('answers zeros on an empty site', async () => {
      const res = await t.http().get('/api/v1/home/summary').expect(200);
      expect(res.body).toMatchObject({ listingCount: 0, agencyCount: 0, regions: [] });
    });
  });

  describe('GET /home/popular-regions', () => {
    it('ranks 지역 by this week’s counted listing views (deduped per viewer)', async () => {
      const { apt, land } = await seedListings();
      const viewers = await Promise.all(
        [1, 2].map(async () => loginUser(t.app, await createUser(t.prisma))),
      );
      for (const s of viewers) {
        await withSession(t.http().post(`/api/v1/listings/${land.id}/view`), s).expect(204);
        // A second beacon of the same viewer does not count again.
        await withSession(t.http().post(`/api/v1/listings/${land.id}/view`), s).expect(204);
      }
      await t
        .http()
        .post(`/api/v1/listings/${apt.id}/view`)
        .set('X-Forwarded-For', '203.0.113.7')
        .set('User-Agent', 'Mozilla/5.0 (test)')
        .expect(204);

      const res = await t.http().get('/api/v1/home/popular-regions').expect(200);
      expect(res.body.items).toEqual([
        {
          rank: 1,
          code: JORYE,
          name: '조례동',
          emdName: '조례동',
          lat: 34.961766,
          lng: 127.523528,
          listingCount: 1,
          dealCounts: { presale: 0, sale: 1, jeonse: 0, monthly: 0 },
          avgPricePerPyeong: null,
          weeklyViewCount: 2,
          rankDelta: null,
        },
        expect.objectContaining({
          rank: 2,
          code: YEONHYANG,
          listingCount: 2,
          dealCounts: { presale: 0, sale: 1, jeonse: 0, monthly: 1 },
          avgPricePerPyeong: 882,
          weeklyViewCount: 1,
        }),
      ]);
      expect(typeof res.body.updatedAt).toBe('string');
    });

    it('filters by category (토지 평당가 = 대지 평당) and computes the rank change', async () => {
      await seedListings();
      // Last week 연향동 led; this week nobody viewed yet.
      const lastWeek = kstDayKey(new Date(Date.now() - 8 * DAY_MS));
      await t.redis.zadd(
        `listings:views:region-daily:${lastWeek}`,
        5,
        `APT|${YEONHYANG}`,
        1,
        `LAND|${JORYE}`,
      );

      const land = await t.http().get('/api/v1/home/popular-regions?assetTypes=LAND').expect(200);
      expect(land.body.items).toEqual([
        expect.objectContaining({
          rank: 1,
          code: JORYE,
          listingCount: 1,
          // 10,000만원 / (330.58㎡ / 3.305785) = 100만원/평.
          avgPricePerPyeong: 100,
          weeklyViewCount: 0,
          rankDelta: 0,
        }),
      ]);

      const oneroom = await t
        .http()
        .get('/api/v1/home/popular-regions?assetTypes=ONEROOM,OFFICETEL&limit=5')
        .expect(200);
      expect(oneroom.body.items).toEqual([
        expect.objectContaining({
          code: YEONHYANG,
          listingCount: 1,
          dealCounts: { presale: 0, sale: 0, jeonse: 0, monthly: 1 },
          avgPricePerPyeong: null,
          rankDelta: null,
        }),
      ]);

      const all = await t.http().get('/api/v1/home/popular-regions?limit=1').expect(200);
      expect(all.body.items).toHaveLength(1);
      expect(all.body.items[0]).toMatchObject({ rank: 1, code: YEONHYANG, rankDelta: 0 });
    });

    it('400 for an unknown category, clamps limit', async () => {
      const bad = await t.http().get('/api/v1/home/popular-regions?assetTypes=CASTLE').expect(400);
      expect(bad.body.code).toBe('VALIDATION_FAILED');
      await seedListings();
      const res = await t.http().get('/api/v1/home/popular-regions?limit=999').expect(200);
      expect(res.body.items).toHaveLength(2);
    });
  });
});
