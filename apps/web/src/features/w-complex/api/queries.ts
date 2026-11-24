import { BannerSlot, type ListingSort, type TradeDealType } from '@house/shared';
import { servedBannersQuery } from '@/lib/ads/query';
import { api, qk, type QueryParams } from '@/lib/api';
import {
  complexAgenciesSchema,
  complexDetailSchema,
  complexListingsSchema,
  complexStatsSchema,
  nearbyComplexesSchema,
  tradePageSchema,
} from './schemas';

/** Filters accepted by `GET /complexes/:id/listings` (names follow `listingListQuerySchema`). */
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
};

export const fetchComplex = (id: string, signal?: AbortSignal) =>
  api.get(path(id), { schema: complexDetailSchema, signal });

export const fetchComplexStats = (id: string, q: ComplexStatsQuery = {}, signal?: AbortSignal) =>
  api.get(path(id, '/stats'), { query: { ...q }, schema: complexStatsSchema, signal });

export const fetchComplexTrades = (id: string, q: ComplexTradesQuery = {}, signal?: AbortSignal) =>
  api.get(path(id, '/trades'), { query: { ...q }, schema: tradePageSchema, signal });

export const fetchComplexListings = (
  id: string,
  q: ComplexListingQuery = {},
  signal?: AbortSignal,
) =>
  api.get(path(id, '/listings'), {
    query: q as QueryParams,
    schema: complexListingsSchema,
    signal,
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
