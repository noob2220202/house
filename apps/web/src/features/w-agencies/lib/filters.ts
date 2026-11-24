import { AssetType } from '@house/shared';
import type { QueryParams } from '@/lib/api';
import { defineFilters, type FilterValues } from '@/lib/map/url-state';
import { AGENCY_API_EXTRAS } from '../api/capabilities';
import { AGENCY_SORTS, type AgencySort } from '../api/schemas';
import { SPECIALTY_LABEL } from './agency';

/**
 * Filters of /agencies, kept in the query string next to the map view (`c`, `z`, `sel`):
 *   ?q=호수&spec=APT&emd=12150115&open=1&presale=1&sort=NAME&area=<bbox>
 */
export const AGENCY_FILTERS = defineFilters({
  q: { type: 'string' },
  /** Specialty chip (single choice). */
  spec: { type: 'string' },
  /** 읍면동 code. */
  emd: { type: 'string' },
  /** 지금 영업 중. */
  open: { type: 'boolean' },
  /** 분양권 취급. */
  presale: { type: 'boolean' },
  sort: { type: 'string', default: 'LISTINGS' },
  /** "이 지역에서 다시 검색": bbox the list is limited to ("swLng,swLat,neLng,neLat"). */
  area: { type: 'string' },
});
export type AgencyFilters = FilterValues<typeof AGENCY_FILTERS>;

export interface SpecialtyOption {
  value: string;
  label: string;
  /** Asset types sent as `specialties` (CSV). */
  assetTypes: readonly AssetType[];
}

/** Specialty chips: 전체 · 아파트 · 원룸·투룸 · 주택 · 상가 · 토지. */
export const SPECIALTY_OPTIONS: readonly SpecialtyOption[] = [
  { value: '', label: '전체', assetTypes: [] },
  { value: 'APT', label: SPECIALTY_LABEL.APT, assetTypes: [AssetType.APT] },
  {
    value: 'ONEROOM',
    label: SPECIALTY_LABEL.ONEROOM,
    assetTypes: [AssetType.ONEROOM, AssetType.OFFICETEL],
  },
  { value: 'HOUSE', label: SPECIALTY_LABEL.HOUSE, assetTypes: [AssetType.HOUSE] },
  { value: 'COMMERCIAL', label: SPECIALTY_LABEL.COMMERCIAL, assetTypes: [AssetType.COMMERCIAL] },
  { value: 'LAND', label: SPECIALTY_LABEL.LAND, assetTypes: [AssetType.LAND] },
];

export function specialtyOption(value: string | null): SpecialtyOption {
  return SPECIALTY_OPTIONS.find((o) => o.value === (value ?? '')) ?? SPECIALTY_OPTIONS[0]!;
}

/** URL `sort` → list sort ("RECENT" is the old name of NEWEST, kept for shared links). */
export function agencySortOf(value: string | null): AgencySort {
  if (value === 'RECENT') return 'NEWEST';
  return AGENCY_SORTS.find((s) => s === value) ?? 'LISTINGS';
}

const BBOX = /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/;

/**
 * Query of `GET /agencies` for the current filters (`agencySearchQuerySchema`: `q`, `emdCode`,
 * `bbox`, `specialties`, `sort`, `page`, `pageSize`). `sort` is always sent — the backend default
 * is RELEVANCE, the list's default is 보유 매물순. `openNow` / `handlesPresale` are not backend
 * params and are only sent while `extras` (default `AGENCY_API_EXTRAS`) is on.
 */
export function toAgencyQuery(
  filters: AgencyFilters,
  extra: { bbox?: string; page?: number; pageSize?: number; extras?: boolean } = {},
): QueryParams {
  const extras = extra.extras ?? AGENCY_API_EXTRAS;
  const q = filters.q?.trim().slice(0, 50);
  const area = filters.area && BBOX.test(filters.area) ? filters.area : undefined;
  const sort = agencySortOf(filters.sort);
  return {
    q: q || undefined,
    specialties: specialtyOption(filters.spec).assetTypes,
    emdCode: filters.emd || undefined,
    openNow: extras && filters.open ? true : undefined,
    handlesPresale: extras && filters.presale ? true : undefined,
    sort,
    bbox: extra.bbox ?? area,
    page: extra.page,
    pageSize: extra.pageSize,
  };
}

/** Result caption: "아파트 전문 52곳" / "검색 결과 3곳" / "전체 86곳". */
export function resultCaption(filters: AgencyFilters, extras = AGENCY_API_EXTRAS): string {
  const spec = specialtyOption(filters.spec);
  if (spec.value) return `${spec.label} 전문`;
  const narrowed = !!(
    filters.q?.trim() ||
    filters.emd ||
    (extras && (filters.open || filters.presale)) ||
    filters.area
  );
  return narrowed ? '검색 결과' : '전체';
}
