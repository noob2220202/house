import { AssetType, DealType, ListingSort } from '@house/shared';
import type { AgencyListingsParams } from '../api/queries';

/**
 * Listing filters of /agency/[id], kept in the query string:
 *   ?type=APT&deal=SALE&sort=PRICE_ASC&page=2
 */
type ParamSource = { get(name: string): string | null };

const pickEnum = <T extends string>(values: Record<string, T>, raw: string | null): T | null =>
  raw && Object.values(values).includes(raw as T) ? (raw as T) : null;

export interface ListingViewParams extends Required<AgencyListingsParams> {
  assetType: AssetType | null;
  dealType: DealType | null;
  sort: ListingSort;
  page: number;
}

export function parseListingParams(params: ParamSource): ListingViewParams {
  const page = Number(params.get('page'));
  return {
    assetType: pickEnum(AssetType, params.get('type')),
    dealType: pickEnum(DealType, params.get('deal')),
    sort: pickEnum(ListingSort, params.get('sort')) ?? ListingSort.LATEST,
    page: Number.isInteger(page) && page > 0 && page < 10_000 ? page : 1,
  };
}

/** Writes the filters into `into`; defaults are left out so the canonical URL stays clean. */
export function serializeListingParams(
  value: ListingViewParams,
  into = new URLSearchParams(),
): URLSearchParams {
  const set = (key: string, v: string | null) => {
    if (v) into.set(key, v);
    else into.delete(key);
  };
  set('type', value.assetType);
  set('deal', value.dealType);
  set('sort', value.sort === ListingSort.LATEST ? null : value.sort);
  set('page', value.page > 1 ? String(value.page) : null);
  return into;
}

/** Sorts offered on the agency page (subset of the backend's `ListingSort`). */
export const AGENCY_LISTING_SORTS: readonly ListingSort[] = [
  ListingSort.LATEST,
  ListingSort.VERIFIED,
  ListingSort.PRICE_ASC,
  ListingSort.PRICE_DESC,
  ListingSort.AREA_DESC,
];

type DealCountKey = 'presale' | 'sale' | 'jeonse' | 'monthly';
const DEAL_COUNT_KEY: Record<DealType, DealCountKey> = {
  PRESALE: 'presale',
  SALE: 'sale',
  JEONSE: 'jeonse',
  MONTHLY: 'monthly',
};

export interface ListingCountsSource {
  activeListingCount: number;
  listingCounts: Record<DealCountKey, number>;
  listingCountsByAsset: Partial<Record<AssetType, number>>;
}

/**
 * Highest page that can hold listings for these filters, from the office's own counters (an upper
 * bound when both 종류 and 거래 are set). Pages beyond it are redirected to the first page, so a
 * crawler iterating `?page=` cannot fill the server fetch cache with empty pages.
 */
export function maxListingPage(
  counts: ListingCountsSource,
  params: Pick<ListingViewParams, 'assetType' | 'dealType'>,
  pageSize: number,
): number {
  let bound = counts.activeListingCount;
  if (params.assetType) bound = Math.min(bound, counts.listingCountsByAsset[params.assetType] ?? 0);
  if (params.dealType)
    bound = Math.min(bound, counts.listingCounts[DEAL_COUNT_KEY[params.dealType]]);
  return Math.max(1, Math.ceil(bound / pageSize));
}
