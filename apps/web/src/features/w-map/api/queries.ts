'use client';
import { BannerSlot, DEFAULT_SGG_CODE, type ListingSort } from '@house/shared';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useServedBanners } from '@/lib/ads/client';
import { api, qk } from '@/lib/api';
import type { MapBounds } from '@/lib/map';
import {
  adAgencySchema,
  complexListSchema,
  complexPageSchema,
  complexPositionSchema,
  listingPageSchema,
  mapSearchResponseSchema,
  regionListSchema,
  suggestResponseSchema,
} from './schemas';

export type ApiFilters = Record<string, string | number | boolean | string[]>;

/** Path of the paginated side list: the public listing search `GET /listings?bbox&…`. */
export const LISTING_LIST_PATH = '/listings';

export const LIST_PAGE_SIZE = 20;

// ---- map + list ---------------------------------------------------------------------------------

/** Markers / clusters for the visible bounds. Keeps the previous markers while panning. */
export function useMapSearch(bbox: string | null, zoom: number, filters: ApiFilters) {
  return useQuery({
    queryKey: qk('map', 'search', { bbox, zoom, filters }),
    queryFn: ({ signal }) =>
      api.get('/map/search', {
        query: { bbox: bbox ?? '', zoom, ...filters },
        schema: mapSearchResponseSchema,
        signal,
      }),
    enabled: bbox !== null,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export interface ListingListParams {
  filters: ApiFilters;
  sort: ListingSort;
  bbox?: string | null;
  complexId?: string;
  /** Only listings without a 단지 (`complex_id IS NULL`): the price pills of the complex modes. */
  withoutComplex?: boolean;
  pageSize?: number;
}

/** Infinite list for the side panel / bottom sheet (bbox list, or one complex's listings). */
export function useListingList(
  { filters, sort, bbox, complexId, withoutComplex, pageSize = LIST_PAGE_SIZE }: ListingListParams,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: qk('listings', 'map-list', {
      filters,
      sort,
      bbox,
      complexId,
      withoutComplex,
      pageSize,
    }),
    queryFn: ({ pageParam, signal }) =>
      api.get(LISTING_LIST_PATH, {
        query: {
          ...filters,
          ...(bbox ? { bbox } : {}),
          ...(complexId ? { complexId } : {}),
          ...(withoutComplex ? { withoutComplex: true } : {}),
          sort,
          page: pageParam,
          pageSize,
        },
        schema: listingPageSchema,
        signal,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

/**
 * The listings behind one price pill — a building (±2 m box) or a few neighbouring buildings that
 * are merged at the current zoom: powers the selected-listing preview.
 */
export function useListingsAt(area: MapBounds | null, filters: ApiFilters, sort: ListingSort) {
  const bbox = area
    ? [area.swLng, area.swLat, area.neLng, area.neLat].map((n) => n.toFixed(6)).join(',')
    : null;
  return useQuery({
    queryKey: qk('listings', 'map-point', { bbox, filters, sort }),
    queryFn: ({ signal }) =>
      api.get(LISTING_LIST_PATH, {
        query: { ...filters, bbox: bbox ?? '', sort, page: 1, pageSize: 30 },
        schema: listingPageSchema,
        signal,
      }),
    enabled: bbox !== null,
    // Zooming regroups the pills; keep the previous rooms on screen while the new box loads.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

// ---- complexes ----------------------------------------------------------------------------------

/** "자주 찾는 단지" ranking. */
export function usePopularComplexes(enabled: boolean, limit = 20) {
  return useQuery({
    queryKey: qk('complexes', 'popular', { limit }),
    queryFn: ({ signal }) =>
      api.get('/complexes/popular', { query: { limit }, schema: complexListSchema, signal }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** 관심 단지 (signed-in only). */
export function useFavoriteComplexes(enabled: boolean) {
  return useQuery({
    queryKey: qk('favorites', 'complexes'),
    queryFn: ({ signal }) =>
      api.get('/me/favorites/complexes', {
        query: { page: 1, pageSize: 50 },
        schema: complexPageSchema,
        signal,
      }),
    enabled,
    staleTime: 60_000,
  });
}

/** Position of a complex that came without coordinates (favourite rows). */
export function fetchComplexPosition(id: string) {
  return api.get(`/complexes/${encodeURIComponent(id)}`, { schema: complexPositionSchema });
}

// ---- regions / search ---------------------------------------------------------------------------

/** 읍면동 of the city (breadcrumb + region picker): `GET /regions?parentCode=<시군구>`. */
export function useRegions() {
  return useQuery({
    queryKey: qk('regions', 'list', { parentCode: DEFAULT_SGG_CODE }),
    queryFn: ({ signal }) =>
      api.get('/regions', {
        query: { parentCode: DEFAULT_SGG_CODE },
        schema: regionListSchema,
        signal,
      }),
    staleTime: 60 * 60_000,
  });
}

/** Autocomplete of the search field (regions, complexes). */
export function useSuggest(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: qk('search', 'suggest', { q: term }),
    queryFn: ({ signal }) =>
      api.get('/search/suggest', {
        query: { q: term, limit: 8 },
        schema: suggestResponseSchema,
        signal,
      }),
    enabled: term.length >= 1,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
}

// ---- MAP_AD banner ------------------------------------------------------------------------------

/**
 * Live MAP_AD banners (shared ads client), targeted by the region in view (REGIONS targeting) and
 * the selected complex (COMPLEXES targeting) when known.
 */
export function useMapBanners(regionCode?: string | null, complexId?: string | null) {
  return useServedBanners(BannerSlot.MAP_AD, { regionCode, complexId });
}

/** Office behind an agency-type map ad (text card: 상호 · 대표 · 태그 · 전화). */
export function useAdAgency(agencyId: string | null | undefined) {
  return useQuery({
    queryKey: qk('agencies', 'ad-card', { agencyId }),
    queryFn: ({ signal }) =>
      api.get(`/agencies/${encodeURIComponent(agencyId ?? '')}`, {
        schema: adAgencySchema,
        signal,
      }),
    enabled: !!agencyId,
    staleTime: 10 * 60_000,
    retry: false,
  });
}
