import { ListingSort, type AssetType, type PopupPage } from '@house/shared';
import { api, qk } from '@/lib/api';
import {
  listingPageSchema,
  popularComplexListSchema,
  popularRegionListSchema,
  popupListSchema,
  suggestResponseSchema,
} from './schemas';

/** Query keys of the home page (`[resource, scope, params]`). */
export const homeKeys = {
  popularComplexes: (assetTypes: readonly AssetType[], limit: number) =>
    qk('complexes', 'popular', { assetTypes, limit }),
  popularRegions: (assetTypes: readonly AssetType[], limit: number) =>
    qk('home', 'popular-regions', { assetTypes, limit }),
  verifiedListings: (assetTypes: readonly AssetType[], pageSize: number) =>
    qk('listings', 'home-verified', { assetTypes, pageSize }),
  popups: (page: PopupPage) => qk('popups', 'serve', { page }),
  suggest: (q: string) => qk('search', 'suggest', { q }),
};

/** GET /complexes/popular?limit&assetTypes */
export const fetchPopularComplexes = (
  assetTypes: readonly AssetType[],
  limit: number,
  signal?: AbortSignal,
) =>
  api.get('/complexes/popular', {
    query: { limit, assetTypes },
    schema: popularComplexListSchema,
    signal,
  });

/** GET /home/popular-regions?assetTypes&limit (ASSUMED) */
export const fetchPopularRegions = (
  assetTypes: readonly AssetType[],
  limit: number,
  signal?: AbortSignal,
) =>
  api.get('/home/popular-regions', {
    query: { limit, assetTypes },
    schema: popularRegionListSchema,
    signal,
  });

/** GET /listings?sort=VERIFIED&verifiedOnly=true — "방금 확인된 실매물". */
export const fetchVerifiedListings = (
  assetTypes: readonly AssetType[],
  pageSize: number,
  signal?: AbortSignal,
) =>
  api.get('/listings', {
    query: { sort: ListingSort.VERIFIED, verifiedOnly: true, pageSize, assetTypes },
    schema: listingPageSchema,
    signal,
  });

/** GET /popups?page */
export const fetchPopups = (page: PopupPage, signal?: AbortSignal) =>
  api.get('/popups', { query: { page }, schema: popupListSchema, signal });

/** GET /search/suggest?q&limit (ASSUMED, owned by w-content) — 지역 / 단지명 autocomplete. */
export const fetchSuggestions = (q: string, signal?: AbortSignal) =>
  api.get('/search/suggest', { query: { q, limit: 8 }, schema: suggestResponseSchema, signal });
