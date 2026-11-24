import { listingListQuerySchema, type ListingListQuery, type ListingSort } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockPaginate } from '@/lib/mock';
import type { ListingSummary } from '@/lib/api/schemas/listing';
import { findAgencyListings } from '../agencies/_fixtures';
import { LISTINGS as MAP_LISTINGS } from '../map/_fixtures';
import { forcedFailure, queryObject, validationError } from '../map/_query';
import { inBbox, matchesFilter, parseExtraFilters, sortListings } from '../map/_search';
import { LISTING_ITEMS, type MockListingItem } from './_list-fixtures';
import { toListingSummary } from './_summary';

const time = (iso: string | null | undefined) => (iso ? Date.parse(iso) : 0);

const SORTERS: Record<ListingSort, (a: MockListingItem, b: MockListingItem) => number> = {
  LATEST: (a, b) => time(b.publishedAt) - time(a.publishedAt),
  VERIFIED: (a, b) => time(b.verifiedAt) - time(a.verifiedAt),
  PRICE_ASC: (a, b) => a.priceSort - b.priceSort,
  PRICE_DESC: (a, b) => b.priceSort - a.priceSort,
  AREA_ASC: (a, b) => (a.exclusiveArea ?? a.landArea ?? 0) - (b.exclusiveArea ?? b.landArea ?? 0),
  AREA_DESC: (a, b) => (b.exclusiveArea ?? b.landArea ?? 0) - (a.exclusiveArea ?? a.landArea ?? 0),
  BUILT_YEAR_DESC: (a, b) => (b.builtYear ?? 0) - (a.builtYear ?? 0),
  PHOTO: (a, b) => b.photoCount - a.photoCount,
};

const between = (v: number | null, min?: number, max?: number) =>
  (min === undefined || (v !== null && v >= min)) &&
  (max === undefined || (v !== null && v <= max));

/** Home sample (14 rows from mockdata.md): every filter of `listingListQuerySchema`. */
function sampleListings(q: ListingListQuery): ListingSummary[] {
  return LISTING_ITEMS.filter(
    (l) =>
      (!q.assetTypes || q.assetTypes.includes(l.assetType)) &&
      (!q.dealTypes || q.dealTypes.includes(l.dealType)) &&
      (!q.verifiedOnly || l.verifiedAt !== null) &&
      (!q.complexId || l.complexId === q.complexId) &&
      (!q.emdCode || l.emdCode.startsWith(q.emdCode)) &&
      between(l.salePrice ?? l.presalePrice, q.priceMin, q.priceMax) &&
      between(l.deposit, q.depositMin, q.depositMax) &&
      between(l.monthlyRent, q.rentMin, q.rentMax) &&
      between(l.exclusiveArea, q.areaMin, q.areaMax) &&
      between(l.rooms, q.roomsMin) &&
      between(l.baths, q.bathsMin) &&
      between(l.builtYear, q.builtYearMin, q.builtYearMax) &&
      (!q.directions || (l.direction !== null && q.directions.includes(l.direction))) &&
      (!q.floorClasses || (l.floorClass !== null && q.floorClasses.includes(l.floorClass))),
  )
    .sort(SORTERS[q.sort])
    .map(toListingSummary);
}

/** Map side list: the full map inventory (every asset type) inside the bbox. */
function mapListings(q: ListingListQuery, sp: URLSearchParams): ListingSummary[] {
  const { bbox, sort, page: _page, pageSize: _pageSize, ...filter } = q;
  const full = { ...filter, ...parseExtraFilters(sp) };
  return sortListings(
    MAP_LISTINGS.filter((l) => (!bbox || inBbox(l, bbox)) && matchesFilter(l, full)),
    sort,
  ).map(toListingSummary);
}

/** Comparable amount in 만원 (월세: 보증금 + 월세×100, the usual 환산 보증금). */
function amountOf(l: ListingSummary): number {
  if (l.dealType === 'MONTHLY') return (l.deposit ?? 0) + (l.monthlyRent ?? 0) * 100;
  if (l.dealType === 'PRESALE') return (l.presalePrice ?? 0) + (l.premium ?? 0);
  return (l.dealType === 'SALE' ? l.salePrice : l.deposit) ?? 0;
}
const areaOf = (l: ListingSummary) => l.supplyArea ?? l.exclusiveArea ?? l.landArea ?? 0;

/** One office's listings (agency page). An unknown office yields an empty page. */
function agencyListings(q: ListingListQuery & { agencyId: string }): ListingSummary[] {
  const items = (findAgencyListings(q.agencyId) ?? []).filter(
    (l) =>
      (!q.assetTypes?.length || q.assetTypes.includes(l.assetType)) &&
      (!q.dealTypes?.length || q.dealTypes.includes(l.dealType)),
  );
  return [...items].sort((a, b) => {
    switch (q.sort) {
      case 'PRICE_ASC':
        return amountOf(a) - amountOf(b);
      case 'PRICE_DESC':
        return amountOf(b) - amountOf(a);
      case 'AREA_ASC':
        return areaOf(a) - areaOf(b);
      case 'AREA_DESC':
        return areaOf(b) - areaOf(a);
      case 'VERIFIED':
        return (b.verifiedAt ?? '').localeCompare(a.verifiedAt ?? '');
      default:
        return 0; // fixture order = newest first
    }
  });
}

// GET /api/v1/listings?…filters&sort&page&pageSize — public paginated list (listings module).
// Query = `listingListQuerySchema` (@house/shared): arrays as CSV, prices in 만원, areas in ㎡.
// One endpoint, three mock data sets: `bbox` → the map inventory, `agencyId` → that office's
// listings, otherwise the home sample. Every row goes through `toListingSummary()`.
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const sp = req.nextUrl.searchParams;
  const q = sp.get('agencyId') ? 'agency' : sp.get('bbox') ? 'map' : 'sample';
  await mockDelay(req, q === 'agency' ? 250 : q === 'map' ? 160 : 150);
  const forced = forcedFailure(req);
  if (forced) return forced;
  const parsed = listingListQuerySchema.safeParse(queryObject(req));
  if (!parsed.success) return validationError(parsed.error);
  const query = parsed.data;
  const { agencyId } = query;
  const rows = agencyId
    ? agencyListings({ ...query, agencyId })
    : query.bbox
      ? mapListings(query, sp)
      : sampleListings(query);
  return mockJson(mockPaginate(rows, req, { pageSize: agencyId ? 12 : 20 }));
}
