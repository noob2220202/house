import { AgencyStatus, ErrorCode, ListingStatus, MapResultKind, RegionLevel } from '@house/shared';
import { ListingSearchRepository } from '../../../src/modules/listings/listing-search.repository';
import { ListingExpiryService } from '../../../src/modules/listings/services/listing-expiry.service';
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
import {
  addCoBroker,
  agencyWithOwner,
  createPublished,
  EMD_CODE,
  OTHER_EMD_CODE,
  seedListing,
} from './helpers';

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

    it("names each listing's 법정동 (emdName) from the regions table", async () => {
      const { agency } = await agencyWithOwner(t);
      // 읍면동 as the 8-digit 행안부 code (the listing carries the 10-digit form), and a 리 row.
      await t.prisma.region.create({
        data: {
          code: EMD_CODE.slice(0, 8),
          name: '남내동',
          fullName: '전남광주통합특별시 순천시 남내동',
          level: RegionLevel.EMD,
        },
      });
      await t.prisma.region.create({
        data: {
          code: '12150310',
          name: '해룡면',
          fullName: '전남광주통합특별시 순천시 해룡면',
          level: RegionLevel.EMD,
        },
      });
      await t.prisma.region.create({
        data: {
          code: '1215031022',
          name: '신대리',
          fullName: '전남광주통합특별시 순천시 해룡면 신대리',
          level: RegionLevel.RI,
          parentCode: '12150310',
        },
      });
      const emd = await seedListing(t, agency.id, {
        listing: { publishedAt: new Date('2026-03-03T00:00:00Z') },
      });
      const ri = await seedListing(t, agency.id, {
        property: { emdCode: '1215031022' },
        listing: { emdCode: '1215031022', publishedAt: new Date('2026-03-02T00:00:00Z') },
      });
      const unknown = await seedListing(t, agency.id, {
        property: { emdCode: OTHER_EMD_CODE },
        listing: { emdCode: OTHER_EMD_CODE, publishedAt: new Date('2026-03-01T00:00:00Z') },
      });

      const res = await t.http().get('/api/v1/listings').expect(200);
      expect(
        (res.body.items as { id: string; emdCode: string; emdName: string | null }[]).map((i) => [
          i.id,
          i.emdCode,
          i.emdName,
        ]),
      ).toEqual([
        [emd.listing.id, EMD_CODE, '남내동'],
        [ri.listing.id, '1215031022', '해룡면 신대리'],
        [unknown.listing.id, OTHER_EMD_CODE, null],
      ]);
      const detail = await t.http().get(`/api/v1/listings/${ri.listing.id}`).expect(200);
      expect(detail.body.emdName).toBe('해룡면 신대리');
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
          fullName: '전남광주통합특별시 순천시 연향동',
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

    it('complex markers are aggregated per complex, busiest first, and flag truncation', async () => {
      const { agency } = await agencyWithOwner(t);
      const complexes = [];
      for (const n of [1, 3, 2]) {
        const c = await createComplex(t.prisma);
        complexes.push(c);
        for (let i = 0; i < n; i++) {
          await seedListing(t, agency.id, {
            property: { complexId: c.id },
            listing: {
              complexId: c.id,
              ...(i === 1
                ? { dealType: 'JEONSE', salePrice: null, deposit: 9_000, priceSort: 9_000 }
                : {}),
            },
          });
        }
      }
      const repo = t.app.get(ListingSearchRepository);
      const rows = await repo.complexAggregates(repo.publicWhere({}), 2);
      // limit + 1 rows → the caller knows it was cut; no complex is split across the cut.
      expect(rows.map((r) => [r.complexId, r.count])).toEqual([
        [complexes[1]!.id, 3],
        [complexes[2]!.id, 2],
        [complexes[0]!.id, 1],
      ]);
      expect(rows[0]!.byDealType).toEqual({
        SALE: expect.objectContaining({ count: 2, priceMin: 30_000 }),
        JEONSE: expect.objectContaining({ count: 1, priceMin: 9_000, priceMax: 9_000 }),
      });
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

    it('caches the list total per (filter, bbox) and invalidates it with the map tiles', async () => {
      const a = await agencyWithOwner(t);
      await createPublished(t, a.ownerSession);
      const url = `/api/v1/listings?bbox=${BBOX}&pageSize=1`;
      expect((await t.http().get(url).expect(200)).body.total).toBe(1);
      expect(await t.redis.keys('house-test:cache:listings:list-total:*')).toHaveLength(1);
      // Another page / sort of the same search reuses the cached total.
      await t.http().get(`${url}&page=2&sort=PRICE_ASC`).expect(200);
      expect(await t.redis.keys('house-test:cache:listings:list-total:*')).toHaveLength(1);

      await seedListing(t, a.agency.id); // behind the API's back: cached until expiry
      expect((await t.http().get(url).expect(200)).body.total).toBe(1);
      await createPublished(t, a.ownerSession); // through the service: version bump
      expect((await t.http().get(url).expect(200)).body.total).toBe(3);
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

  describe('agency approval gates public visibility', () => {
    it('suspending the primary agency removes its listings from list, map, detail and favorites', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const other = await createPublished(t, b.ownerSession);
      const user = await createUser(t.prisma);
      const us = await loginUser(t.app, user);
      await withSession(t.http().put(`/api/v1/me/favorites/listings/${id}`), us).expect(200);

      await t.prisma.agency.update({
        where: { id: a.agency.id },
        data: { status: AgencyStatus.SUSPENDED },
      });
      expect(await t.app.get(ListingsModerationService).onAgencyStatusChanged(a.agency.id)).toBe(1);

      const list = await t.http().get('/api/v1/listings').expect(200);
      expect((list.body.items as { id: string }[]).map((i) => i.id)).toEqual([other]);
      const map = await t.http().get(`/api/v1/map/search?bbox=${BBOX}&zoom=17`).expect(200);
      expect(map.body.total).toBe(1);
      await t.http().get(`/api/v1/listings/${id}`).expect(404);
      const favs = await withSession(t.http().get('/api/v1/me/favorites/listings'), us).expect(200);
      expect(favs.body.total).toBe(0);
      await withSession(t.http().put(`/api/v1/me/favorites/listings/${id}`), us).expect(404);
      const ag = await t.prisma.agency.findUniqueOrThrow({ where: { id: a.agency.id } });
      expect(ag.activeListingCount).toBe(0);

      // Re-approval brings it back.
      await t.prisma.agency.update({
        where: { id: a.agency.id },
        data: { status: AgencyStatus.APPROVED },
      });
      await t.app.get(ListingsModerationService).onAgencyStatusChanged(a.agency.id);
      await t.http().get(`/api/v1/listings/${id}`).expect(200);
    });

    it('a suspended co-broker is neither disclosed nor counted', async () => {
      const a = await agencyWithOwner(t);
      const b = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const solo = await createPublished(t, a.ownerSession);
      await addCoBroker(t, id, a, b);
      const user = await createUser(t.prisma);
      const us = await loginUser(t.app, user);
      await withSession(t.http().put(`/api/v1/me/favorites/listings/${id}`), us).expect(200);
      await withSession(t.http().get(`/api/v1/listings/${id}`), us).expect(200);
      // Page-scoped co-broker counts on every summary list.
      const countsOf = (items: unknown) =>
        Object.fromEntries(
          (items as { id: string; agencyCount: number }[]).map((i) => [i.id, i.agencyCount]),
        );
      const list = await t.http().get('/api/v1/listings').expect(200);
      expect(countsOf(list.body.items)).toEqual({ [id]: 2, [solo]: 1 });
      const mine = await withSession(
        t.http().get('/api/v1/agency/listings'),
        a.ownerSession,
      ).expect(200);
      expect(countsOf(mine.body.items)).toEqual({ [id]: 2, [solo]: 1 });
      const favs = await withSession(t.http().get('/api/v1/me/favorites/listings'), us).expect(200);
      expect(favs.body.items[0].listing.agencyCount).toBe(2);
      const recent = await withSession(
        t.http().get('/api/v1/me/recent-views?targetType=LISTING'),
        us,
      ).expect(200);
      expect(recent.body.items[0].listing.agencyCount).toBe(2);

      await t.prisma.agency.update({
        where: { id: b.agency.id },
        data: { status: AgencyStatus.SUSPENDED },
      });
      const pub = await t.http().get(`/api/v1/listings/${id}`).expect(200);
      expect(pub.body.agencyCount).toBe(1);
      expect(pub.body.agencies).toHaveLength(1);
      const after = await t.http().get('/api/v1/listings').expect(200);
      expect(countsOf(after.body.items)).toEqual({ [id]: 1, [solo]: 1 });
    });
  });

  describe('ad expiry job (ListingExpiryService)', () => {
    it('reverts overdue ads to DRAFT, refreshes counters, notifies the primary, and is idempotent', async () => {
      const a = await agencyWithOwner(t);
      const complex = await createComplex(t.prisma);
      const id = await createPublished(t, a.ownerSession, { property: { complexId: complex.id } });
      const fresh = await createPublished(t, a.ownerSession);
      await t.prisma.listing.update({
        where: { id },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      const before = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      const svc = t.app.get(ListingExpiryService);

      expect(await svc.expireDue()).toBe(1);
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: ListingStatus.DRAFT, version: before.version + 1 });
      await t.http().get(`/api/v1/listings/${id}`).expect(404);
      await t.http().get(`/api/v1/listings/${fresh}`).expect(200);
      const [c, ag] = await Promise.all([
        t.prisma.complex.findUniqueOrThrow({ where: { id: complex.id } }),
        t.prisma.agency.findUniqueOrThrow({ where: { id: a.agency.id } }),
      ]);
      expect(c.activeListingCount).toBe(0);
      expect(ag.activeListingCount).toBe(1);
      const notes = await t.prisma.notification.findMany({ where: { userId: a.owner.id } });
      expect(notes).toHaveLength(1);
      expect(notes[0]).toMatchObject({
        type: 'LISTING_EXPIRED',
        data: { listingId: id, agencyId: a.agency.id },
      });

      expect(await svc.expireDue()).toBe(0);
      expect(await t.prisma.notification.count({ where: { userId: a.owner.id } })).toBe(1);

      // Small batches loop until everything due is processed.
      await t.prisma.listing.updateMany({
        where: { id: fresh },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await seedListing(t, a.agency.id, { listing: { expiresAt: new Date(Date.now() - 1000) } });
      expect(await svc.expireDue(new Date(), 1)).toBe(2);
      expect(
        await t.prisma.listing.count({
          where: { status: { in: ['ACTIVE', 'RESERVED'] }, expiresAt: { lt: new Date() } },
        }),
      ).toBe(0);
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

    it('close force-closes a public listing, refreshes counters and bumps the version', async () => {
      const a = await agencyWithOwner(t);
      const id = await createPublished(t, a.ownerSession);
      const before = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      const moderation = t.app.get(ListingsModerationService);
      expect(await moderation.close(id, '거래완료 확인')).toBe(ListingStatus.ACTIVE);
      const row = await t.prisma.listing.findUniqueOrThrow({ where: { id } });
      expect(row).toMatchObject({ status: 'CLOSED', version: before.version + 1 });
      expect(row.closedAt).not.toBeNull();
      await t.http().get(`/api/v1/listings/${id}`).expect(404);
      const ag = await t.prisma.agency.findUniqueOrThrow({ where: { id: a.agency.id } });
      expect(ag.activeListingCount).toBe(0);
    });
  });
});
