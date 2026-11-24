import { BannerSlot, type ListingSort, type TradeDealType } from '@house/shared';
import { servedBannersQuery } from '@/lib/ads/query';
import { api, qk } from '@/lib/api';
import {
  complexAgenciesSchema,
  complexDetailSchema,
  complexListingPageSchema,
  complexListingSummarySchema,
  complexStatsSchema,
  nearbyComplexesSchema,
  tradePageSchema,
  type ListingAgency,
} from './schemas';
import { listingDetailSchema } from '@/features/w-listing/api/schemas';
import { loadComplexListings } from '../lib/complex-listings';

/**
 * Filters of the complex list: `GET /listings?complexId=` (names follow `listingListQuerySchema`)
 * plus `dong`, which the backend list has no filter for and is applied here.
 */
export interface ComplexListingQuery {
  dealTypes?: readonly string[];
  priceMin?: number;
  priceMax?: number;
  depositMin?: number;
  depositMax?: number;
  areaMin?: number;
  areaMax?: number;
  directions?: readonly string[];
  floorClasses?: readonly string[];
  roomsMin?: number;
  bathsMin?: number;
  dong?: string;
  sort?: ListingSort;
  page?: number;
  pageSize?: number;
}

export interface ComplexStatsQuery {
  dealType?: TradeDealType;
  areaTypeId?: string;
  /** Trend window ending at the latest month with data (backend default 36). */
  months?: number;
  /** Trades only (`/trades`); `/stats` takes `months`. */
  fromYm?: number;
  toYm?: number;
}

export interface ComplexTradesQuery extends ComplexStatsQuery {
  page?: number;
  pageSize?: number;
}

const path = (id: string, rest = '') => `/complexes/${encodeURIComponent(id)}${rest}`;

/** Query keys — everything under ['complexes', …] so one invalidation refreshes a complex. */
export const complexKeys = {
  detail: (id: string) => qk('complexes', 'detail', id),
  stats: (id: string, q: ComplexStatsQuery) => qk('complexes', 'stats', { id, ...q }),
  trades: (id: string, q: ComplexTradesQuery) => qk('complexes', 'trades', { id, ...q }),
  listings: (id: string, q: ComplexListingQuery) => qk('complexes', 'listings', { id, ...q }),
  nearby: (id: string, limit: number) => qk('complexes', 'nearby', { id, limit }),
  agencies: (id: string) => qk('complexes', 'agencies', id),
  listingAgencies: (listingId: string) => qk('listings', 'agencies', listingId),
};

export const fetchComplex = (id: string, signal?: AbortSignal) =>
  api.get(path(id), { schema: complexDetailSchema, signal });

/**
 * Counts one view of the /complex/[id] page. The API has no separate 단지 view beacon — its view
 * counter runs on `GET /complexes/:id` (deduped per viewer and KST day, bots not counted). The ISR
 * page's own server-side read is shared by every visitor and never counts (no visitor IP, Node
 * user agent), so the browser makes this read once per visit. Best effort, never cached.
 */
export const recordComplexView = (id: string) => api.get(path(id), { cache: 'no-store' });

/** Trend window asked of `/stats` (months): the longest period the views offer ("전체" ≈ 10년). */
export const STATS_WINDOW_MONTHS = 120;

export const fetchComplexStats = (id: string, q: ComplexStatsQuery = {}, signal?: AbortSignal) =>
  api.get(path(id, '/stats'), {
    query: { months: STATS_WINDOW_MONTHS, ...q },
    schema: complexStatsSchema,
    signal,
  });

export const fetchComplexTrades = (id: string, q: ComplexTradesQuery = {}, signal?: AbortSignal) =>
  api.get(path(id, '/trades'), { query: { ...q }, schema: tradePageSchema, signal });

export const fetchComplexListings = (
  id: string,
  q: ComplexListingQuery = {},
  signal?: AbortSignal,
) =>
  loadComplexListings(id, q, {
    page: (query) => api.get('/listings', { query, schema: complexListingPageSchema, signal }),
    summary: () => api.get(path(id, '/listings'), { schema: complexListingSummarySchema, signal }),
  });

export const fetchNearbyComplexes = (id: string, limit = 10, signal?: AbortSignal) =>
  api
    .get(path(id, '/nearby'), { query: { limit }, schema: nearbyComplexesSchema, signal })
    .then((r) => r.items);

export const fetchComplexAgencies = (id: string, signal?: AbortSignal) =>
  api.get(path(id, '/agencies'), { schema: complexAgenciesSchema, signal }).then((r) => r.items);

/** Live banners of the COMPLEX_FEATURED_AGENCY slot targeted at this complex. */
/**
 * Query of the COMPLEX_FEATURED_AGENCY slot (shared ads client; started early by the panel and
 * read by the card).
 */
export const featuredBannersQuery = (complexId: string) =>
  servedBannersQuery(BannerSlot.COMPLEX_FEATURED_AGENCY, { complexId });

/**
 * 표시·광고 명시사항 of every office on a listing (`GET /listings/:id` → `agencies`), loaded when a
 * complex row opens its office list (the list rows carry `primaryAgency` only).
 */
export const fetchListingAgencies = (listingId: string, signal?: AbortSignal) =>
  api
    .get(`/listings/${encodeURIComponent(listingId)}`, { schema: listingDetailSchema, signal })
    .then((d): ListingAgency[] =>
      d.agencies.map((a) => ({
        agencyId: a.agencyId,
        name: a.name,
        representativeName: a.representativeName,
        phone: a.contactPhone ?? a.phone,
        roadAddress: a.roadAddress,
        registrationNumber: a.registrationNumber,
        logoUrl: a.logoUrl ?? null,
        isPrimary: a.isPrimary,
        specialtyTag: a.specialtyTag ?? null,
        complexListingCount: null,
        avgResponseMinutes: a.avgResponseMinutes ?? null,
        price: null,
      })),
    );
