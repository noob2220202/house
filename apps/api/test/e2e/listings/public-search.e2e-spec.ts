import { ErrorCode, ListingStatus, MapResultKind, RegionLevel } from '@house/shared';
import { ListingViewsService } from '../../../src/modules/listings/services/listing-views.service';
import { ListingsModerationService } from '../../../src/modules/listings/services/listings-moderation.service';
import {
  createComplex,
  createTestApp,
  createUser,
  loginUser,
  resetAll,
  withSession,
  type TestApp,
} from '../../utils';
import { agencyWithOwner, createPublished, EMD_CODE, OTHER_EMD_CODE, seedListing } from './helpers';

const BBOX = '127.40,34.90,127.60,35.00';
const SECRET_HO = '비밀호수7777';

describe('public listing search (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  describe('GET /listings', () => {
    it('returns public listings only, newest first, paginated', async () => {
      const { agency } = await agencyWithOwner(t);
      const older = await seedListing(t, agency.id, {
        listing: { publishedAt: new Date('2026-01-01T00:00:00Z') },
      });
      const newer = await seedListing(t, agency.id, {
        listing: { publishedAt: new Date('2026-02-01T00:00:00Z'), status: ListingStatus.RESERVED },
      });
      await seedListing(t, agency.id, { listing: { status: ListingStatus.DRAFT } });
      await seedListing(t, agency.id, { listing: { status: ListingStatus.HIDDEN } });
      await seedListing(t, agency.id, { listing: { deletedAt: new Date() } });

      const res = await t.http().get('/api/v1/listings').expect(200);
      expect(res.body).toMatchObject({ total: 2, page: 1, pageSize: 20, totalPages: 1 });
      expect((res.body.items as { id: string }[]).map((i) => i.id)).toEqual([
        newer.listing.id,
        older.listing.id,
      ]);
      expect(res.body.items[0]).toMatchObject({
        status: 'RESERVED',
        primaryAgency: { id: agency.id, name: agency.name },
        agencyCount: 1,
        exclusiveArea: 84.97,
        exclusiveAreaPyeong: 25.7,
      });

      const p2 = await t.http().get('/api/v1/listings?pageSize=1&page=2').expect(200);
      expect(p2.body).toMatchObject({ total: 2, totalPages: 2, items: [{ id: older.listing.id }] });
    });

    it('applies filters and every sort (nulls last)', async () => {
      const { agency } = await agencyWithOwner(t);
      const cheap = await seedListing(t, agency.id, {
        listing: { salePrice: 10_000, priceSort: 10_000, builtYear: 2000, photoCount: 1 },
      });
      const pricey = await seedListing(t, agency.id, {
        listing: {
          salePrice: 90_000,
          priceSort: 90_000,
          builtYear: 2020,
          verifiedAt: new Date('2026-03-01T00:00:00Z'),
          photoCount: 5,
          exclusiveArea: '120.5',
        },
      });
      const rent = await seedListing(t, agency.id, {
        listing: {
          dealType: 'MONTHLY',
          salePrice: null,
          deposit: 500,
          monthlyRent: 40,
          priceSort: 500,
          builtYear: null,
          exclusiveArea: '20',
        },
      });
      const ids = async (qs: string): Promise<string[]> =>
        (
          (await t.http().get(`/api/v1/listings?${qs}`).expect(200)).body.items as { id: string }[]
        ).map((i) => i.id);

      expect(await ids('sort=PRICE_ASC')).toEqual([
        rent.listing.id,
        cheap.listing.id,
        pricey.listing.id,
      ]);
      expect(await ids('sort=PRICE_DESC')).toEqual([
        pricey.listing.id,
        cheap.listing.id,
        rent.listing.id,
      ]);
      expect((await ids('sort=BUILT_YEAR_DESC'))[2]).toBe(rent.listing.id);
      expect((await ids('sort=VERIFIED'))[0]).toBe(pricey.listing.id);
      expect((await ids('sort=PHOTO'))[0]).toBe(pricey.listing.id);
      expect((await ids('sort=AREA_ASC'))[0]).toBe(rent.listing.id);
      expect((await ids('sort=AREA_DESC'))[0]).toBe(pricey.listing.id);

      // priceMax only constrains 매매/분양권 rows; 월세 rows pass through.
      expect(await ids('priceMax=50000&sort=PRICE_ASC')).toEqual([
        rent.listing.id,
        cheap.listing.id,
      ]);
      expect(await ids('dealTypes=MONTHLY&rentMax=50')).toEqual([rent.listing.id]);
      expect(await ids('dealTypes=MONTHLY&rentMin=50')).toEqual([]);
      expect(await ids('verifiedOnly=true')).toEqual([pricey.listing.id]);
      expect(await ids('areaMin=100')).toEqual([pricey.listing.id]);
      expect(await ids(`emdCode=${OTHER_EMD_CODE}`)).toEqual([]);
      expect((await ids(`emdCode=${EMD_CODE.slice(0, 8)}`)).length).toBe(3);
      expect(await ids(`agencyId=${agency.id}&dealTypes=SALE&sort=PRICE_ASC`)).toEqual([
        cheap.listing.id,
        pricey.listing.id,
      ]);
      expect(await ids('bbox=127.0,34.0,127.1,34.1')).toEqual([]);
      expect((await ids(`bbox=${BBOX}`)).length).toBe(3);
    });

    it('400 for invalid query values', async () => {
      for (const qs of [
        'sort=CHEAPEST',
        'priceMin=100&priceMax=10',
        'dealTypes=RENT',
        'pageSize=500',
        'page=1000&pageSize=100',
        'bbox=1,2,3',
      ]) {
        const res = await t.http().get(`/api/v1/listings?${qs}`).expect(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      }
    });
  });

  describe('GET /listings/:id', () => {
    it('shows 명시사항 + agency disclosure and never leaks 호 / private note', async () => {
      const a = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession, {
        floorDisplay: 'CLASS',
        property: { ho: SECRET_HO },
      });
      const res = await t.http().get(`/api/v1/listings/${id}`).expect(200);
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(SECRET_HO);
      expect(res.body.property).not.toHaveProperty('ho');
      expect(res.body).not.toHaveProperty('hiddenReason');
      expect(res.body.property.floor).toBeNull();
      expect(res.body.floorLabel).toBe('중/20층');
      expect(res.body.property).toMatchObject({
        approvalDate: '2015-06-30',
        direction: 'SOUTH',
        directionBasis: 'LIVING_ROOM',
        parkingSpaces: 1,
        totalFloors: 20,
      });
      expect(res.body.agencies).toEqual([
        expect.objectContaining({
          isPrimary: true,
          name: a.agency.name,
          roadAddress: a.agency.roadAddress,
          phone: a.agency.phone,
          registrationNumber: a.agency.registrationNumber,
          representativeName: a.agency.representativeName,
        }),
      ]);
      expect(res.body.isFavorite).toBe(false);
    });

    it('drafts / hidden / unknown ids are 404, bad ids 400', async () => {
      const { agency } = await agencyWithOwner(t);
      const draft = await seedListing(t, agency.id, { listing: { status: ListingStatus.DRAFT } });
      const r = await t.http().get(`/api/v1/listings/${draft.listing.id}`).expect(404);
      expect(r.body.code).toBe(ErrorCode.LISTING_NOT_FOUND);
      await t.http().get('/api/v1/listings/123').expect(400);
    });

    it('counts one view per viewer within the window and flushes totals idempotently', async () => {
      const { agency } = await agencyWithOwner(t);
      const { listing } = await seedListing(t, agency.id, { listing: { viewCount: 10 } });
      const url = `/api/v1/listings/${listing.id}`;
      const first = await t.http().get(url).set('User-Agent', 'ua-1').expect(200);
      expect(first.body.viewCount).toBe(11);
      const again = await t.http().get(url).set('User-Agent', 'ua-1').expect(200);
      expect(again.body.viewCount).toBe(11);
      const other = await t.http().get(url).set('User-Agent', 'ua-2').expect(200);
      expect(other.body.viewCount).toBe(12);

      const user = await createUser(t.prisma);
      const s = await loginUser(t.app, user);
      const mine = await withSession(t.http().get(url), s).expect(200);
      expect(mine.body.viewCount).toBe(13);

      const views = t.app.get(ListingViewsService);
      expect(await views.flush()).toBe(1);
      expect(await views.flush()).toBe(0);
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id: listing.id } });
      expect(row.viewCount).toBe(13);

      const recent = await t.prisma.recentView.findMany({ where: { userId: user.id } });
      expect(recent).toEqual([
        expect.objectContaining({ targetType: 'LISTING', targetId: listing.id }),
      ]);
    });
  });

  describe('GET /map/search', () => {
    async function fixtures() {
      const { agency } = await agencyWithOwner(t);
      await t.prisma.region.create({
        data: {
          code: EMD_CODE,
          name: '연향동',
          fullName: '전라남도 순천시 연향동',
          level: RegionLevel.EMD,
          lat: 34.951,
          lng: 127.512,
        },
      });
      const complex = await createComplex(t.prisma, {
        lat: 34.9505,
        lng: 127.4875,
        builtYear: 2010,
      });
      await seedListing(t, agency.id, {
        property: { lat: 34.9505, lng: 127.4875, complexId: complex.id },
        listing: { complexId: complex.id, salePrice: 30_000, priceSort: 30_000 },
      });
      await seedListing(t, agency.id, {
        property: { lat: 34.9505, lng: 127.4875, complexId: complex.id },
        listing: {
          complexId: complex.id,
          dealType: 'JEONSE',
          salePrice: null,
          deposit: 20_000,
          priceSort: 20_000,
        },
      });
      await seedListing(t, agency.id, {
        property: { lat: 34.9507, lng: 127.4877, assetType: 'ONEROOM' },
        listing: {
          assetType: 'ONEROOM',
          dealType: 'MONTHLY',
          salePrice: null,
          deposit: 300,
          monthlyRent: 35,
          priceSort: 300,
        },
      });
      await seedListing(t, agency.id, {
        property: { lat: 34.99, lng: 127.55, emdCode: OTHER_EMD_CODE },
        listing: { emdCode: OTHER_EMD_CODE },
      });
      await seedListing(t, agency.id, { listing: { status: ListingStatus.DRAFT } });
      return { agency, complex };
    }

    it('low zoom → 읍면동 clusters with per-deal-type counts and price ranges', async () => {
      await fixtures();
      const res = await t.http().get(`/api/v1/map/search?bbox=${BBOX}&zoom=11`).expect(200);
      expect(res.body.kind).toBe(MapResultKind.REGION_CLUSTERS);
      expect(res.body.total).toBe(4);
      const yeonhyang = (res.body.clusters as { regionCode: string }[]).find(
        (c) => c.regionCode === EMD_CODE,
      );
      expect(yeonhyang).toMatchObject({
        name: '연향동',
        lat: 34.951,
        lng: 127.512,
        count: 3,
        byDealType: {
          SALE: { count: 1, priceMin: 30_000, priceMax: 30_000 },
          JEONSE: { count: 1, priceMin: 20_000, priceMax: 20_000 },
          MONTHLY: { count: 1, priceMin: 300, priceMax: 300, rentMin: 35, rentMax: 35 },
        },
      });
      const other = (res.body.clusters as { regionCode: string }[]).find(
        (c) => c.regionCode === OTHER_EMD_CODE,
      );
      expect(other).toMatchObject({ count: 1, name: null });
    });

    it('mid zoom → grid clusters; filters apply', async () => {
      await fixtures();
      const res = await t.http().get(`/api/v1/map/search?bbox=${BBOX}&zoom=14`).expect(200);
      expect(res.body.kind).toBe(MapResultKind.GRID_CLUSTERS);
      expect(res.body.total).toBe(4);
      const big = (res.body.clusters as { count: number; lat: number }[]).find(
        (c) => c.count === 3,
      );
      expect(big?.lat).toBeCloseTo(34.9506, 3);

      const sale = await t
        .http()
        .get(`/api/v1/map/search?bbox=${BBOX}&zoom=14&dealTypes=SALE&priceMax=25000`)
        .expect(200);
      expect(sale.body.total).toBe(0);
      const oneroom = await t
        .http()
        .get(`/api/v1/map/search?bbox=${BBOX}&zoom=14&assetTypes=ONEROOM`)
        .expect(200);
      expect(oneroom.body.total).toBe(1);
    });

    it('high zoom → complex markers + individual listing markers', async () => {
      const { complex } = await fixtures();
      const res = await t
        .http()
        .get('/api/v1/map/search?bbox=127.485,34.949,127.490,34.952&zoom=17')
        .expect(200);
      expect(res.body.kind).toBe(MapResultKind.MARKERS);
      expect(res.body.complexes).toEqual([
        expect.objectContaining({
          complexId: complex.id,
          name: complex.name,
          builtYear: 2010,
          count: 2,
          byDealType: {
            SALE: { count: 1, priceMin: 30_000, priceMax: 30_000 },
            JEONSE: { count: 1, priceMin: 20_000, priceMax: 20_000 },
          },
        }),
      ]);
      expect(res.body.listings).toHaveLength(1);
      expect(res.body.listings[0]).toMatchObject({
        dealType: 'MONTHLY',
        deposit: 300,
        monthlyRent: 35,
      });
      expect(res.body.listings[0]).not.toHaveProperty('ho');
      expect(res.body).toMatchObject({ total: 3, truncated: false });
    });

    it('caches hot tiles and invalidates them when public data changes', async () => {
      const a = await agencyWithOwner(t);
      const url = `/api/v1/map/search?bbox=${BBOX}&zoom=11`;
      expect((await t.http().get(url).expect(200)).body.total).toBe(0);
      const keys = await t.redis.keys('house-test:cache:listings:map:*');
      expect(keys.length).toBe(1);

      // A DB write behind the API's back is not visible until the tile expires…
      await seedListing(t, a.agency.id);
      expect((await t.http().get(url).expect(200)).body.total).toBe(0);
      // …but any write through the service bumps the cache version.
      await createPublished(t, a.ownerSession);
      expect((await t.http().get(url).expect(200)).body.total).toBe(2);
    });

    it('400 for missing/oversized bbox and out-of-range zoom', async () => {
      for (const qs of [
        'zoom=12',
        `bbox=${BBOX}`,
        'bbox=120,30,130,40&zoom=12',
        `bbox=${BBOX}&zoom=30`,
        `bbox=${BBOX}&zoom=12&floorClasses=TOP`,
      ]) {
        const res = await t.http().get(`/api/v1/map/search?${qs}`).expect(400);
        expect(res.body.code).toBe(ErrorCode.VALIDATION_FAILED);
      }
    });
  });

  describe('moderation hooks (exported service)', () => {
    it('hide removes a listing from public search; unhide returns it to DRAFT', async () => {
      const a = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const moderation = t.app.get(ListingsModerationService);
      expect(await moderation.hide(id, '허위매물 신고 처리')).toBe(ListingStatus.ACTIVE);
      await t.http().get(`/api/v1/listings/${id}`).expect(404);
      const ag = await t.prisma.agency.findUniqueOrThrow({ where: { id: a.agency.id } });
      expect(ag.activeListingCount).toBe(0);
      // Agency sees the reason; status is admin-controlled.
      const mine = await withSession(
        t.http().get(`/api/v1/agency/listings/${id}`),
        a.ownerSession,
      ).expect(200);
      expect(mine.body).toMatchObject({ status: 'HIDDEN', hiddenReason: '허위매물 신고 처리' });
      await withSession(t.http().post(`/api/v1/agency/listings/${id}/status`), a.ownerSession)
        .send({ status: 'ACTIVE' })
        .expect(400);

      await moderation.unhide(id);
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: 'DRAFT', hiddenReason: null });
    });
  });
});
