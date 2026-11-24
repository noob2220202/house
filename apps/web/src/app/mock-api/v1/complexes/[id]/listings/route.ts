import { DealType, ListingSort, listingListQuerySchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import type { DealSummary } from '@/features/w-complex/api/schemas';
import { mockDelay, mockError, mockGuard, mockJson, mockNotFound, mockPaginate } from '@/lib/mock';
import { findComplexSpec } from '../../_fixtures';
import {
  findMockAgency,
  listingsOfComplex,
  toListingItem,
  type MockListing,
} from '../../_listings';

type Ctx = { params: Promise<{ id: string }> };

const time = (iso: string | null) => (iso ? Date.parse(iso) : 0);

const SORTERS: Record<ListingSort, (a: MockListing, b: MockListing) => number> = {
  LATEST: (a, b) => time(b.publishedAt) - time(a.publishedAt),
  VERIFIED: (a, b) => time(b.verifiedAt) - time(a.verifiedAt),
  PRICE_ASC: (a, b) => a.priceSort - b.priceSort,
  PRICE_DESC: (a, b) => b.priceSort - a.priceSort,
  AREA_ASC: (a, b) => (a.exclusiveArea ?? 0) - (b.exclusiveArea ?? 0),
  AREA_DESC: (a, b) => (b.exclusiveArea ?? 0) - (a.exclusiveArea ?? 0),
  BUILT_YEAR_DESC: (a, b) => b.builtYear - a.builtYear,
  PHOTO: (a, b) => b.photoCount - a.photoCount,
};

const minMax = (values: number[]): [number | null, number | null] =>
  values.length ? [Math.min(...values), Math.max(...values)] : [null, null];

const inRange = (v: number | null, min?: number, max?: number) =>
  v !== null && (min === undefined || v >= min) && (max === undefined || v <= max);

const isSaleLike = (l: MockListing) =>
  l.dealType === DealType.SALE || l.dealType === DealType.PRESALE;

// GET /api/v1/complexes/:id/listings?…filters&dong&sort&page&pageSize — public (complexes module).
// The complex's active listings with the filter / sort params of `listingListQuerySchema` (+ `dong`),
// each with its co-brokering offices, plus `summary` (count + price range per deal type, 동 list).
// 매매가 filters (priceMin/Max) apply to 매매·분양권, 보증금 filters (depositMin/Max) to 전세·월세.
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const { id } = await ctx.params;
  const spec = findComplexSpec(id);
  if (!spec) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');

  const sp = req.nextUrl.searchParams;
  const raw = Object.fromEntries(
    [...sp.entries()].filter(([k]) => !k.startsWith('_') && k !== 'dong'),
  );
  const parsed = listingListQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return mockError(
      400,
      'VALIDATION_FAILED',
      '요청 값이 올바르지 않습니다.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const q = parsed.data;
  const dong = sp.get('dong');
  const all = listingsOfComplex(spec);

  const hasPrice = q.priceMin !== undefined || q.priceMax !== undefined;
  const hasDeposit = q.depositMin !== undefined || q.depositMax !== undefined;
  const hasRent = q.rentMin !== undefined || q.rentMax !== undefined;
  const hasArea = q.areaMin !== undefined || q.areaMax !== undefined;

  const rows = all
    .filter(
      (l) =>
        (!q.dealTypes || q.dealTypes.includes(l.dealType)) &&
        (!q.verifiedOnly || l.verifiedAt !== null) &&
        (!dong || l.dong === dong) &&
        (!hasPrice || !isSaleLike(l) || inRange(l.priceSort, q.priceMin, q.priceMax)) &&
        (!hasDeposit || isSaleLike(l) || inRange(l.deposit, q.depositMin, q.depositMax)) &&
        (!hasRent ||
          l.dealType !== DealType.MONTHLY ||
          inRange(l.monthlyRent, q.rentMin, q.rentMax)) &&
        (!hasArea || inRange(l.exclusiveArea, q.areaMin, q.areaMax)) &&
        (q.roomsMin === undefined || (l.rooms ?? 0) >= q.roomsMin) &&
        (q.bathsMin === undefined || (l.baths ?? 0) >= q.bathsMin) &&
        (!q.directions || (l.direction !== null && q.directions.includes(l.direction))) &&
        (!q.floorClasses || (l.floorClass !== null && q.floorClasses.includes(l.floorClass))) &&
        (!q.agencyId || l.agencies.some((a) => findMockAgency(a.code)?.id === q.agencyId)),
    )
    // Stable sort: ties keep the fixture order.
    .sort(SORTERS[sp.has('sort') ? q.sort : ListingSort.VERIFIED]);

  const byDealType: DealSummary[] = Object.values(DealType).map((dealType) => {
    const group = all.filter((l) => l.dealType === dealType);
    const [priceMin, priceMax] = minMax(
      group.flatMap((l) => [l.priceSort, l.priceMax ?? l.priceSort]),
    );
    const [rentMin, rentMax] = minMax(
      group.flatMap((l) => (l.monthlyRent === null ? [] : [l.monthlyRent])),
    );
    return { dealType, count: group.length, priceMin, priceMax, rentMin, rentMax };
  });
  const dongs = [...new Set(all.flatMap((l) => (l.dong ? [l.dong] : [])))].sort((a, b) =>
    a.localeCompare(b, 'ko', { numeric: true }),
  );

  const page = mockPaginate(rows, req, { pageSize: 20 });
  return mockJson({
    ...page,
    items: page.items.map((l) => toListingItem(spec, l)),
    summary: { total: all.length, byDealType, dongs },
  });
}
