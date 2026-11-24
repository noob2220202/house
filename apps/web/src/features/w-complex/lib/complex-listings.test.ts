import { describe, expect, it, vi } from 'vitest';
import {
  complexDetailSchema,
  complexListingSummarySchema,
  complexListingPageSchema,
  complexStatsSchema,
  tradePageSchema,
} from '../api/schemas';
import { COMPLEX_LIST_WINDOW, dongsOf, loadComplexListings } from './complex-listings';

const row = (id: string, dong: string) => ({
  id,
  assetType: 'APT',
  dealType: 'SALE',
  status: 'ACTIVE',
  dong,
  salePrice: 40000,
});
const page = (rows: ReturnType<typeof row>[], total = rows.length) =>
  complexListingPageSchema.parse({
    items: rows,
    page: 1,
    pageSize: rows.length || 1,
    total,
    totalPages: 1,
  });
const summary = complexListingSummarySchema.parse({
  complexId: 'C01',
  total: 3,
  byDealType: [
    {
      dealType: 'SALE',
      count: 3,
      minPrice: 39000,
      maxPrice: 48500,
      minMonthlyRent: null,
      maxMonthlyRent: null,
    },
  ],
});

describe('loadComplexListings (GET /listings?complexId + GET /complexes/:id/listings)', () => {
  const rows = [row('a', '103동'), row('b', '101동'), row('c', '103동')];

  it('pages small complexes locally, filters 동 and lists the 동 names', async () => {
    const source = { page: vi.fn(async () => page(rows)), summary: vi.fn(async () => summary) };
    const all = await loadComplexListings('C01', { pageSize: 2 }, source);
    expect(source.page).toHaveBeenCalledWith(
      expect.objectContaining({ complexId: 'C01', page: 1, pageSize: COMPLEX_LIST_WINDOW }),
    );
    expect(all).toMatchObject({ total: 3, totalPages: 2, page: 1 });
    expect(all.items.map((l) => l.id)).toEqual(['a', 'b']);
    expect(all.summary).toMatchObject({ total: 3, dongs: ['101동', '103동'] });
    expect(all.summary.byDealType[0]).toMatchObject({ priceMin: 39000, priceMax: 48500 });
    const dong = await loadComplexListings('C01', { dong: '103동' }, source);
    expect(dong.items.map((l) => l.id)).toEqual(['a', 'c']);
    expect(source.page).not.toHaveBeenCalledWith(expect.objectContaining({ dong: '103동' }));
  });

  it('asks the server for later pages of a big complex', async () => {
    const source = {
      page: vi.fn(async (q: Record<string, unknown>) =>
        q.pageSize === COMPLEX_LIST_WINDOW ? page(rows, 250) : page([row('z', '105동')], 250),
      ),
      summary: vi.fn(async () => {
        throw new Error('summary down');
      }),
    };
    const p3 = await loadComplexListings('C01', { page: 3, pageSize: 20 }, source);
    expect(source.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 3, pageSize: 20 }),
    );
    expect(p3).toMatchObject({ page: 3, total: 250, totalPages: 13 });
    expect(p3.summary.total).toBe(0);
  });

  it('sorts 동 names naturally', () => {
    expect(
      dongsOf([{ dong: '1201동' }, { dong: '103동' }, { dong: null }, { dong: '103동' }]),
    ).toEqual(['103동', '1201동']);
  });
});

describe('complex wire schemas', () => {
  it('maps the detail photos and latest trades', () => {
    const d = complexDetailSchema.parse({
      id: 'C01',
      name: '신대 레이크파크',
      assetType: 'APT',
      lat: 34.93,
      lng: 127.55,
      photos: [
        {
          mediaId: 'm1',
          thumbUrl: '/t',
          mediumUrl: '/m',
          largeUrl: '/l',
          caption: null,
          sortOrder: 0,
        },
      ],
      latestTrades: [
        {
          id: 't1',
          dealType: 'SALE',
          dealDate: '2026-10-14',
          yearMonth: 202610,
          exclusiveArea: 84.98,
          exclusivePyeong: 25.7,
          areaTypeId: 'A34',
          floor: 17,
          price: 43500,
          deposit: null,
          monthlyRent: null,
          cancelled: false,
          cancelledAt: null,
          contractType: null,
        },
      ],
    });
    expect(d.photos[0]).toEqual({ id: 'm1', url: '/l', caption: null });
    expect(d.latestTrades[0]).toMatchObject({ dealYm: 202610, price: 43500 });
  });

  it('reads one trend from ComplexStatsView (series of the 평형, else overall)', () => {
    const point = {
      yearMonth: 202610,
      tradeCount: 2,
      medianPrice: 43500,
      minPrice: 43000,
      maxPrice: 44000,
      avgPrice: 43500,
      medianMonthlyRent: null,
    };
    const one = complexStatsSchema.parse({
      complexId: 'C01',
      dealType: 'SALE',
      fromYm: 202311,
      toYm: 202610,
      series: [
        {
          exclusiveArea: 84.98,
          exclusivePyeong: 25.7,
          areaTypeId: 'A34',
          pyeongLabel: '34평',
          points: [point],
        },
      ],
      overall: [],
      latest: [],
    });
    expect(one).toMatchObject({ areaTypeId: 'A34', months: [point] });
    const all = complexStatsSchema.parse({
      complexId: 'C01',
      dealType: 'SALE',
      fromYm: null,
      toYm: null,
      series: [],
      overall: [{ ...point, medianPrice: 1 }],
      latest: [],
    });
    expect(all.months[0]?.medianPrice).toBe(1);
  });

  it('parses trade pages (yearMonth → dealYm)', () => {
    const p = tradePageSchema.parse({
      items: [
        {
          id: 't',
          dealType: 'JEONSE',
          dealDate: '2026-09-01',
          yearMonth: 202609,
          exclusiveArea: 59.9,
          floor: 3,
          price: null,
          deposit: 26000,
          monthlyRent: null,
          cancelled: false,
          contractType: '신규',
        },
      ],
      page: 1,
      pageSize: 8,
      total: 1,
      totalPages: 1,
    });
    expect(p.items[0]?.dealYm).toBe(202609);
  });
});
