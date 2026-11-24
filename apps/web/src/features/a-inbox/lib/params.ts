import { AssetType, DealRequestType } from '@house/shared';
import type { InboxStage } from '../api/schemas';

/**
 * URL state of the inbox lists. Filters live in the query string so a view can be bookmarked,
 * shared with a colleague and restored by the back button.
 */

type SearchInput = URLSearchParams | Record<string, string | string[] | undefined>;

function reader(input: SearchInput): (key: string) => string {
  if (input instanceof URLSearchParams) return (key) => input.get(key) ?? '';
  return (key) => {
    const v = input[key];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
}

const csv = (value: string) =>
  value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function pageOf(value: string): number {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 1 ? Math.min(n, 9999) : 1;
}

function oneOf<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function toSearch(entries: [string, string | null | undefined][]): string {
  const sp = new URLSearchParams();
  for (const [key, value] of entries) if (value) sp.set(key, value);
  const text = sp.toString();
  return text ? `?${text}` : '';
}

// ---------- requests ----------

export const REQUEST_STAGE_TABS = ['all', 'new', 'proposed', 'accepted', 'ended'] as const;
export type RequestStageTab = (typeof REQUEST_STAGE_TABS)[number];
export const REQUEST_TYPE_TABS = ['all', 'sell', 'find'] as const;
export type RequestTypeTab = (typeof REQUEST_TYPE_TABS)[number];
export const REQUEST_SORTS = ['latest', 'expiring'] as const;
export type RequestSort = (typeof REQUEST_SORTS)[number];

export interface RequestFilters {
  stage: RequestStageTab;
  type: RequestTypeTab;
  /** 읍면동 codes (the request's location or one of its wanted regions). */
  regions: string[];
  assets: AssetType[];
  sort: RequestSort;
  page: number;
}

export const DEFAULT_REQUEST_FILTERS: RequestFilters = {
  stage: 'all',
  type: 'all',
  regions: [],
  assets: [],
  sort: 'latest',
  page: 1,
};

const ASSET_VALUES = Object.values(AssetType) as AssetType[];

export function parseRequestFilters(input: SearchInput): RequestFilters {
  const get = reader(input);
  return {
    stage: oneOf(get('stage'), REQUEST_STAGE_TABS, 'all'),
    type: oneOf(get('type'), REQUEST_TYPE_TABS, 'all'),
    regions: [...new Set(csv(get('region')).filter((c) => /^\d{5,10}$/.test(c)))].slice(0, 20),
    assets: [
      ...new Set(
        csv(get('asset')).filter((a): a is AssetType => ASSET_VALUES.includes(a as AssetType)),
      ),
    ],
    sort: oneOf(get('sort'), REQUEST_SORTS, 'latest'),
    page: pageOf(get('page')),
  };
}

/** "?stage=new&type=sell&region=…" — defaults are left out so the plain URL stays clean. */
export function requestFiltersToSearch(f: RequestFilters): string {
  return toSearch([
    ['stage', f.stage === 'all' ? null : f.stage],
    ['type', f.type === 'all' ? null : f.type],
    ['region', f.regions.join(',')],
    ['asset', f.assets.join(',')],
    ['sort', f.sort === 'latest' ? null : f.sort],
    ['page', f.page > 1 ? String(f.page) : null],
  ]);
}

const STAGE_PARAM: Record<Exclude<RequestStageTab, 'all'>, InboxStage> = {
  new: 'NEW',
  proposed: 'PROPOSED',
  accepted: 'ACCEPTED',
  ended: 'ENDED',
};

export const REQUESTS_PAGE_SIZE = 10;

/** Query of GET /agency/deal-requests. */
export function requestFiltersToQuery(f: RequestFilters) {
  return {
    type:
      f.type === 'all'
        ? undefined
        : f.type === 'sell'
          ? DealRequestType.SELL_OR_LEASE
          : DealRequestType.WANTED,
    stage: f.stage === 'all' ? undefined : STAGE_PARAM[f.stage],
    regionCodes: f.regions.length > 0 ? f.regions : undefined,
    assetTypes: f.assets.length > 0 ? f.assets : undefined,
    sort: f.sort === 'expiring' ? 'EXPIRING' : undefined,
    page: f.page,
    pageSize: REQUESTS_PAGE_SIZE,
  };
}

/** Number of narrowing filters (stage tab and sort excluded) — drives "필터 초기화". */
export function activeRequestFilterCount(f: RequestFilters): number {
  return (
    (f.type === 'all' ? 0 : 1) + (f.regions.length > 0 ? 1 : 0) + (f.assets.length > 0 ? 1 : 0)
  );
}
