import { ListingSort, type AssetType, type DealType } from '@house/shared';
import { api, qk, type QueryParams } from '@/lib/api';
import {
  agencyDetailSchema,
  agencyListingPageSchema,
  agencyPageSchema,
  agencyRegionsSchema,
} from './schemas';

/** Offices per list page ("더 보기"). */
export const AGENCY_LIST_PAGE_SIZE = 20;
/** One map request returns every office in the viewport (the backend caps pageSize at 100). */
export const AGENCY_MAP_PAGE_SIZE = 100;
export const AGENCY_LISTINGS_PAGE_SIZE = 12;

export const agencyKeys = {
  list: (query: QueryParams) => qk('agencies', 'list', query),
  map: (query: QueryParams) => qk('agencies', 'map', query),
  regions: () => qk('agencies', 'regions'),
  detail: (id: string) => qk('agencies', 'detail', id),
  listings: (query: QueryParams) => qk('agencies', 'listings', query),
};

/** GET /agencies — public office search (list and map share the endpoint). */
export function fetchAgencies(query: QueryParams, signal?: AbortSignal) {
  return api.get('/agencies', { query, schema: agencyPageSchema, signal });
}

/** GET /agencies/regions — 읍면동 facet. */
export function fetchAgencyRegions(signal?: AbortSignal) {
  return api.get('/agencies/regions', { schema: agencyRegionsSchema, signal });
}

/** GET /agencies/:id */
export function fetchAgency(id: string, signal?: AbortSignal) {
  return api.get(`/agencies/${encodeURIComponent(id)}`, { schema: agencyDetailSchema, signal });
}

export interface AgencyListingsParams {
  assetType?: AssetType | null;
  dealType?: DealType | null;
  sort?: ListingSort;
  page?: number;
}

export interface AgencyListingsScope {
  /**
   * Only listings whose primary (최초 등록) office is this one (`primaryAgencyId`) — the office's
   * own 홈페이지. Default: every listing the office advertises, co-brokered ones included.
   */
  primaryOnly?: boolean;
}

/** Query of `GET /listings` for one office (`listingListQuerySchema` param names). */
export function agencyListingsQuery(
  agencyId: string,
  params: AgencyListingsParams,
  scope: AgencyListingsScope = {},
): QueryParams {
  return {
    ...(scope.primaryOnly ? { primaryAgencyId: agencyId } : { agencyId }),
    assetTypes: params.assetType ? [params.assetType] : undefined,
    dealTypes: params.dealType ? [params.dealType] : undefined,
    sort: params.sort && params.sort !== ListingSort.LATEST ? params.sort : undefined,
    page: params.page && params.page > 1 ? params.page : undefined,
    pageSize: AGENCY_LISTINGS_PAGE_SIZE,
  };
}

/** GET /listings?agencyId= (or `primaryAgencyId`) — active listings of one office. */
export function fetchAgencyListings(
  id: string,
  params: AgencyListingsParams,
  signal?: AbortSignal,
  scope?: AgencyListingsScope,
) {
  return api.get('/listings', {
    query: agencyListingsQuery(id, params, scope),
    schema: agencyListingPageSchema,
    signal,
  });
}
