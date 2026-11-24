import {
  DEAL_TYPE_LABEL,
  DIRECTION_LABEL,
  DealType,
  Direction,
  FLOOR_CLASS_LABEL,
  FloorClass,
  ListingSort,
} from '@house/shared';
import { formatPriceFilter, type AreaUnit } from '@/lib/format';
import { defineFilters, type FilterValues } from '@/lib/map';
import type { ComplexListingQuery } from '../api/queries';
import type { ComplexAreaType, ComplexListingSummary, DealSummary } from '../api/schemas';
import { areaTypeLabel } from './listing';

/**
 * Filters of the complex panel. They live in the URL next to the map state (`?complex=<id>&c-deal=SALE…`)
 * with a `c-` prefix so they never collide with the map page's own filter params.
 */
export const PANEL_FILTERS = defineFilters({
  'c-deal': { type: 'string' },
  'c-area': { type: 'string' },
  'c-price': { type: 'string' },
  'c-dir': { type: 'string' },
  'c-dong': { type: 'string' },
  'c-floor': { type: 'string' },
  'c-rooms': { type: 'number' },
  'c-baths': { type: 'number' },
  'c-sort': { type: 'string', default: ListingSort.VERIFIED },
  'c-unit': { type: 'string', default: 'pyeong' },
});
export type PanelFilterValues = FilterValues<typeof PANEL_FILTERS>;
export type PanelFilterKey = keyof PanelFilterValues;

/** URL param that selects the complex shown in the map's left panel. */
export const COMPLEX_PARAM = 'complex';

export interface Option {
  value: string;
  label: string;
}

const isDealType = (v: string | null): v is DealType => v !== null && v in DealType;
const isDirection = (v: string | null): v is Direction => v !== null && v in Direction;
const isFloorClass = (v: string | null): v is FloorClass => v !== null && v in FloorClass;
const isSort = (v: string | null): v is ListingSort => v !== null && v in ListingSort;

export const unitOf = (f: PanelFilterValues): AreaUnit =>
  f['c-unit'] === 'sqm' ? 'sqm' : 'pyeong';
export const sortOf = (f: PanelFilterValues): ListingSort =>
  isSort(f['c-sort']) ? f['c-sort'] : ListingSort.VERIFIED;

// ---- options ------------------------------------------------------------------------------------

/** Deal types that currently have listings, in the usual 매매 · 전세 · 월세 · 분양권 order. */
export function dealOptions(summary: ComplexListingSummary | undefined): Option[] {
  const order: DealType[] = [DealType.SALE, DealType.JEONSE, DealType.MONTHLY, DealType.PRESALE];
  const counts = new Map(summary?.byDealType.map((d) => [d.dealType, d.count]));
  return order
    .filter((d) => !summary || (counts.get(d) ?? 0) > 0)
    .map((d) => ({ value: d, label: DEAL_TYPE_LABEL[d] }));
}

/** Key of a 평형 group: whole ㎡ of the 전용면적 ("84"). 84A / 84B share one option. */
export const areaKey = (a: Pick<ComplexAreaType, 'exclusiveArea'>) =>
  String(Math.floor(a.exclusiveArea));

export function areaOptions(areaTypes: readonly ComplexAreaType[], unit: AreaUnit): Option[] {
  const seen = new Set<string>();
  return [...areaTypes]
    .sort((a, b) => a.exclusiveArea - b.exclusiveArea)
    .flatMap((a) => {
      const value = areaKey(a);
      if (seen.has(value)) return [];
      seen.add(value);
      return [{ value, label: areaTypeLabel(a, unit) }];
    });
}

/** Cut sizes in 만원: below 1억 at 500 / 1,000 / 2,000 / 5,000 …, from 1억 up at 2,500 and coarser. */
const STEPS_SMALL = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000] as const;
const STEPS_LARGE = [2500, 5000, 10000, 20000, 50000, 100000] as const;
/** At most this many cut points → at most four bands. */
const MAX_CUTS = 3;

export interface PriceBand extends Option {
  /** Inclusive lower bound in 만원 (null = open). */
  min: number | null;
  /** Exclusive upper bound in 만원 (null = open): a 4억 listing belongs to "4억~…", not "…~4억". */
  max: number | null;
}

/**
 * Round cut points strictly above the cheapest and at or below the dearest price:
 * 39,000–48,500 → [40000, 45000]. Every band they delimit therefore overlaps the price range.
 */
export function priceCuts(min: number, max: number): number[] {
  for (const step of min >= 10000 ? STEPS_LARGE : STEPS_SMALL) {
    const cuts: number[] = [];
    for (let v = (Math.floor(min / step) + 1) * step; v <= max; v += step) cuts.push(v);
    if (cuts.length <= MAX_CUTS) return cuts;
  }
  return [];
}

/** Label of a half-open band: the upper bound is exclusive, so "…미만" instead of the shared "…이하". */
function bandText(min: number | null, max: number | null): string {
  return min === null
    ? formatPriceFilter(null, max).replace(/이하$/, '미만')
    : formatPriceFilter(min, max);
}

/** Readable label of any band key, also one that is not offered any more (shared / old URLs). */
export function bandLabel(value: string): string {
  const band = parseBand(value);
  return band ? bandText(band.min ?? null, band.max ?? null) : value;
}

/**
 * Three-ish price bands inside a price range (만원), half-open so no listing sits in two bands:
 * 39,000–48,500 → "4억 미만" · "4억~4억 5,000" · "4억 5,000 이상". A range too narrow to cut has no
 * bands (the filter then only offers 전체).
 */
export function priceBands(min: number | null, max: number | null): PriceBand[] {
  if (min === null || max === null || max <= 0 || max <= min) return [];
  const cuts = priceCuts(min, max);
  if (cuts.length === 0) return [];
  const band = (a: number | null, b: number | null): PriceBand => ({
    value: `${a ?? ''}-${b ?? ''}`,
    label: bandText(a, b),
    min: a,
    max: b,
  });
  return [
    band(null, cuts[0]!),
    ...cuts.slice(1).map((cut, i) => band(cuts[i]!, cut)),
    band(cuts[cuts.length - 1]!, null),
  ];
}

/** Parses a band key ("30000-40000", "-30000", "40000-"): `min` is inclusive, `max` exclusive. */
export function parseBand(value: string | null): { min?: number; max?: number } | null {
  if (!value) return null;
  const m = /^(\d*)-(\d*)$/.exec(value);
  if (!m || (m[1] === '' && m[2] === '')) return null;
  return {
    min: m[1] === '' ? undefined : Number(m[1]),
    max: m[2] === '' ? undefined : Number(m[2]),
  };
}

/** The deal summary whose price range drives the 금액 filter for the chosen 거래 filter. */
export function priceBasis(
  summary: ComplexListingSummary | undefined,
  deal: string | null,
): DealSummary | undefined {
  const withListings = summary?.byDealType.filter((d) => d.count > 0) ?? [];
  if (isDealType(deal)) return withListings.find((d) => d.dealType === deal);
  return (
    withListings.find((d) => d.dealType === DealType.SALE) ??
    withListings.find((d) => d.dealType === DealType.PRESALE) ??
    withListings[0]
  );
}

export function priceOptions(
  summary: ComplexListingSummary | undefined,
  deal: string | null,
): PriceBand[] {
  const basis = priceBasis(summary, deal);
  return basis ? priceBands(basis.priceMin, basis.priceMax) : [];
}

export const DIRECTION_OPTIONS: readonly Option[] = (
  [
    Direction.SOUTH,
    Direction.SOUTH_EAST,
    Direction.SOUTH_WEST,
    Direction.EAST,
    Direction.WEST,
    Direction.NORTH_EAST,
    Direction.NORTH_WEST,
    Direction.NORTH,
  ] as const
).map((d) => ({ value: d, label: DIRECTION_LABEL[d] }));

export const FLOOR_OPTIONS: readonly Option[] = (
  [FloorClass.LOW, FloorClass.MID, FloorClass.HIGH] as const
).map((f) => ({ value: f, label: FLOOR_CLASS_LABEL[f] }));

export const ROOM_OPTIONS: readonly Option[] = [2, 3, 4].map((n) => ({
  value: String(n),
  label: `${n}개 이상`,
}));
export const BATH_OPTIONS: readonly Option[] = [1, 2].map((n) => ({
  value: String(n),
  label: `${n}개 이상`,
}));

/** Short labels of the sort menu (the design calls 실매물확인순 "확인일순"). */
export const SORT_OPTIONS: readonly { value: ListingSort; label: string }[] = [
  { value: ListingSort.VERIFIED, label: '확인일순' },
  { value: ListingSort.LATEST, label: '최신순' },
  { value: ListingSort.PRICE_ASC, label: '낮은가격순' },
  { value: ListingSort.PRICE_DESC, label: '높은가격순' },
  { value: ListingSort.AREA_DESC, label: '넓은면적순' },
  { value: ListingSort.AREA_ASC, label: '작은면적순' },
  { value: ListingSort.PHOTO, label: '사진많은순' },
];

// ---- filters → API query ------------------------------------------------------------------------

/**
 * Translates the panel filters into the query of `GET /complexes/:id/listings`.
 * 금액 is sent as 매매가 (priceMin/Max) for 매매·분양권, as 보증금 (depositMin/Max) for 전세·월세, and as
 * both when no deal type is chosen. A band's exclusive upper bound is sent as `max - 1`.
 */
export function toListingQuery(
  f: PanelFilterValues,
  areaTypes: readonly ComplexAreaType[],
): ComplexListingQuery {
  const q: ComplexListingQuery = { sort: sortOf(f) };
  const deal = f['c-deal'];
  if (isDealType(deal)) q.dealTypes = [deal];

  if (f['c-area']) {
    const group = areaTypes.filter((a) => areaKey(a) === f['c-area']);
    if (group.length > 0) {
      const areas = group.map((a) => a.exclusiveArea);
      q.areaMin = Math.round((Math.min(...areas) - 0.5) * 100) / 100;
      q.areaMax = Math.round((Math.max(...areas) + 0.5) * 100) / 100;
    }
  }

  const band = parseBand(f['c-price']);
  if (band) {
    // Bands are half-open [min, max); the API bounds are inclusive and prices are whole 만원.
    const upper = band.max === undefined ? undefined : band.max - 1;
    const rental = deal === DealType.JEONSE || deal === DealType.MONTHLY;
    if (!rental) {
      q.priceMin = band.min;
      q.priceMax = upper;
    }
    if (rental || !isDealType(deal)) {
      q.depositMin = band.min;
      q.depositMax = upper;
    }
  }

  if (isDirection(f['c-dir'])) q.directions = [f['c-dir']];
  if (isFloorClass(f['c-floor'])) q.floorClasses = [f['c-floor']];
  if (f['c-dong']) q.dong = f['c-dong'];
  if (f['c-rooms'] && f['c-rooms'] > 0) q.roomsMin = f['c-rooms'];
  if (f['c-baths'] && f['c-baths'] > 0) q.bathsMin = f['c-baths'];
  return q;
}

const LIST_FILTER_KEYS = [
  'c-deal',
  'c-area',
  'c-price',
  'c-dir',
  'c-dong',
  'c-floor',
  'c-rooms',
  'c-baths',
] as const satisfies readonly PanelFilterKey[];

/** Number of list-narrowing filters in effect (sort / unit do not count). */
export function activeFilterCount(f: PanelFilterValues): number {
  return LIST_FILTER_KEYS.filter((k) => f[k] !== null && f[k] !== '' && f[k] !== 0).length;
}

/** A patch that clears every list-narrowing filter. */
export function clearedFilters(): Partial<PanelFilterValues> {
  return {
    'c-deal': null,
    'c-area': null,
    'c-price': null,
    'c-dir': null,
    'c-dong': null,
    'c-floor': null,
    'c-rooms': null,
    'c-baths': null,
  };
}
