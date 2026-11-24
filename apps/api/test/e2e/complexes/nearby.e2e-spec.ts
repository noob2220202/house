import {
  AgencyStatus,
  DealType,
  ListingAgencyStatus,
  ListingStatus,
  TradeDealType,
  TradeSyncKind,
} from '@house/shared';
import { createAgency, createComplex, createListing, resetAll, type TestApp } from '../../utils';
import { createComplexesApp, FakeTradeApi, NIL_UUID } from './helpers';

describe('complexes: GET /complexes/:id/nearby + /agencies (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createComplexesApp(new FakeTradeApi());
  });
  beforeEach(() => resetAll(t));
  afterAll(() => t?.close());

  /** Origin at (34.95, 127.50); ~1.1 km north, ~2.2 km north and ~5.5 km north. */
  async function seedNeighbourhood() {
    const origin = await createComplex(t.prisma, { name: '기준단지', lat: 34.95, lng: 127.5 });
    const near = await createComplex(t.prisma, {
      name: '가까운단지',
      lat: 34.96,
      lng: 127.5,
      emdName: '조례동',
      households: 1200,
      builtYear: 2015,
    });
    const mid = await createComplex(t.prisma, { name: '중간단지', lat: 34.97, lng: 127.5 });
    await createComplex(t.prisma, { name: '먼단지', lat: 35.0, lng: 127.5 });
    await createComplex(t.prisma, {
      name: '삭제단지',
      lat: 34.951,
      lng: 127.5,
      deletedAt: new Date(),
    });
    return { origin, near, mid };
  }

  describe('nearby', () => {
    it('lists live 단지 within the radius, nearest first, with counts and a representative 평형', async () => {
      const { origin, near, mid } = await seedNeighbourhood();
      const main = await t.prisma.complexAreaType.create({
        data: { complexId: near.id, exclusiveArea: '84.97', supplyArea: '112.40', households: 800 },
      });
      await t.prisma.complexAreaType.create({
        data: { complexId: near.id, exclusiveArea: '59.90', households: 400 },
      });
      const { agency } = await createAgency(t.prisma);
      for (const price of [45_000, 44_000]) {
        await createListing(t.prisma, {
          agencyId: agency.id,
          property: { complexId: near.id, areaTypeId: main.id },
          listing: { salePrice: price, priceSort: price },
        });
      }
      await createListing(t.prisma, {
        agencyId: agency.id,
        property: { complexId: near.id },
        listing: { dealType: DealType.JEONSE, salePrice: null, deposit: 20_000, priceSort: 20_000 },
      });
      await createListing(t.prisma, {
        agencyId: agency.id,
        property: { complexId: near.id },
        listing: { status: ListingStatus.DRAFT },
      });
      // `mid` has no listing: its 평형 price falls back to the latest 매매 실거래가.
      const midArea = await t.prisma.complexAreaType.create({
        data: { complexId: mid.id, exclusiveArea: '84.00', households: 100 },
      });
      await t.prisma.tradeRecord.create({
        data: {
          sourceKey: 'nearby-e2e-1',
          kind: TradeSyncKind.APT_TRADE,
          complexId: mid.id,
          areaTypeId: midArea.id,
          sggCode: '12150',
          aptName: '중간단지',
          dealType: TradeDealType.SALE,
          dealDate: new Date('2026-10-01'),
          dealYm: 202610,
          exclusiveArea: '84.00',
          price: 31_000,
        },
      });

      const res = await t.http().get(`/api/v1/complexes/${origin.id}/nearby`).expect(200);
      expect((res.body.items as { name: string }[]).map((i) => i.name)).toEqual([
        '가까운단지',
        '중간단지',
      ]);
      expect(res.body.items[0]).toEqual({
        id: near.id,
        name: '가까운단지',
        assetType: 'APT',
        emdName: '조례동',
        lat: 34.96,
        lng: 127.5,
        distanceM: expect.any(Number),
        households: 1200,
        builtYear: 2015,
        activeListingCount: 3,
        dealCounts: { presale: 0, sale: 2, jeonse: 1, monthly: 0 },
        representative: { pyeongLabel: '34평', price: 44_000, dealType: 'SALE' },
      });
      expect(res.body.items[0].distanceM).toBeGreaterThan(1000);
      expect(res.body.items[0].distanceM).toBeLessThan(1200);
      expect(res.body.items[1]).toMatchObject({
        activeListingCount: 0,
        representative: { pyeongLabel: '25평', price: 31_000, dealType: 'SALE' },
      });

      const wide = await t
        .http()
        .get(`/api/v1/complexes/${origin.id}/nearby?radius=10000&limit=1`)
        .expect(200);
      expect(wide.body.items).toHaveLength(1);
      const all = await t
        .http()
        .get(`/api/v1/complexes/${origin.id}/nearby?radius=10000`)
        .expect(200);
      expect((all.body.items as { name: string }[]).map((i) => i.name)).toEqual([
        '가까운단지',
        '중간단지',
        '먼단지',
      ]);
      expect(all.body.items[2].representative).toBeNull();
    });

    it('404 for an unknown or deleted 단지', async () => {
      await t.http().get(`/api/v1/complexes/${NIL_UUID}/nearby`).expect(404);
      const gone = await createComplex(t.prisma, { deletedAt: new Date() });
      await t.http().get(`/api/v1/complexes/${gone.id}/nearby`).expect(404);
    });
  });

  describe('agencies', () => {
    it('lists approved offices with public listings in the 단지, most listings first', async () => {
      const complex = await createComplex(t.prisma);
      const { agency: a } = await createAgency(t.prisma, { name: '가나공인중개사' });
      const { agency: b } = await createAgency(t.prisma, { name: '다라공인중개사' });
      const { agency: suspended } = await createAgency(t.prisma, {
        status: AgencyStatus.SUSPENDED,
      });
      const inComplex = { property: { complexId: complex.id } };
      await createListing(t.prisma, { agencyId: a.id, ...inComplex });
      const shared = await createListing(t.prisma, { agencyId: b.id, ...inComplex });
      await createListing(t.prisma, { agencyId: b.id, ...inComplex });
      // a co-brokers b's listing; a pending request does not count.
      await t.prisma.listingAgency.create({
        data: { listingId: shared.listing.id, agencyId: a.id },
      });
      const pendingAgency = await createAgency(t.prisma);
      await t.prisma.listingAgency.create({
        data: {
          listingId: shared.listing.id,
          agencyId: pendingAgency.agency.id,
          status: ListingAgencyStatus.PENDING,
        },
      });
      await createListing(t.prisma, { agencyId: suspended.id, ...inComplex });
      await createListing(t.prisma, {
        agencyId: a.id,
        ...inComplex,
        listing: { status: ListingStatus.DRAFT },
      });

      const res = await t.http().get(`/api/v1/complexes/${complex.id}/agencies`).expect(200);
      expect(res.body.items).toEqual([
        {
          agencyId: a.id,
          name: '가나공인중개사',
          representativeName: a.representativeName,
          phone: a.phone,
          logoUrl: null,
          specialtyLabel: null,
          complexListingCount: 2,
          avgResponseMinutes: null,
        },
        expect.objectContaining({ agencyId: b.id, complexListingCount: 2 }),
      ]);
      const one = await t
        .http()
        .get(`/api/v1/complexes/${complex.id}/agencies?limit=1`)
        .expect(200);
      expect(one.body.items).toHaveLength(1);
      await t.http().get(`/api/v1/complexes/${NIL_UUID}/agencies`).expect(404);
    });
  });
});
