import {
  DEAL_TYPE_LABEL,
  DIRECTION_LABEL,
  type DealType,
  Direction,
  FLOOR_CLASS_LABEL,
  FloorClass,
  LISTING_OPTION_LABEL,
  ListingOption,
  formatManwon,
  pyeongToSqm,
  sqmToPyeong,
} from '@house/shared';
import type { AreaUnit } from '@/lib/format';
import { defineFilters, type FilterValues } from '@/lib/map';
import {
  LAND_CATEGORY_LABEL,
  LAND_ZONE_LABEL,
  LandCategory,
  LandZone,
  ROOM_TYPE_LABEL,
  RoomType,
} from '../api/schemas';
import type { AssetConfig, FilterKind, ScaleKey } from '../config/assets';

/**
 * Map filters live in the URL under the SAME names the API takes (`listingFilterSchema`), so a
 * shared link reads like the request: /map/apt?dealTypes=SALE,PRESALE&priceMax=50000&areaMin=99.17
 * Amounts are 만원, areas ㎡. `roomTypes`, `landZones`, `landCategories` are assumed extras.
 */
export const FILTER_SPEC = defineFilters({
  assetTypes: { type: 'csv' },
  dealTypes: { type: 'csv' },
  priceMin: { type: 'number' },
  priceMax: { type: 'number' },
  depositMin: { type: 'number' },
  depositMax: { type: 'number' },
  rentMin: { type: 'number' },
  rentMax: { type: 'number' },
  areaMin: { type: 'number' },
  areaMax: { type: 'number' },
  roomsMin: { type: 'number' },
  bathsMin: { type: 'number' },
  directions: { type: 'csv' },
  floorClasses: { type: 'csv' },
  builtYearMin: { type: 'number' },
  builtYearMax: { type: 'number' },
  options: { type: 'csv' },
  verifiedOnly: { type: 'boolean' },
  roomTypes: { type: 'csv' },
  landZones: { type: 'csv' },
  landCategories: { type: 'csv' },
});
export type MapFilters = FilterValues<typeof FILTER_SPEC>;
export type MapFilterKey = keyof MapFilters;

/** Filter keys each control owns (used for drafts, reset and the active state of its chip). */
export const KIND_KEYS: Record<FilterKind, readonly MapFilterKey[]> = {
  category: ['assetTypes'],
  deal: ['dealTypes'],
  roomType: ['roomTypes'],
  area: ['areaMin', 'areaMax'],
  price: ['priceMin', 'priceMax', 'depositMin', 'depositMax', 'rentMin', 'rentMax'],
  deposit: ['depositMin', 'depositMax'],
  rent: ['rentMin', 'rentMax'],
  direction: ['directions'],
  rooms: ['roomsMin'],
  baths: ['bathsMin'],
  floor: ['floorClasses'],
  built: ['builtYearMin', 'builtYearMax'],
  options: ['options'],
  quickOptions: ['options'],
  landZone: ['landZones'],
  landCategory: ['landCategories'],
  more: [],
};

/** Keys of a control, with "추가 필터" expanded to its sections. */
export function keysOf(kind: FilterKind, asset: AssetConfig): readonly MapFilterKey[] {
  return kind === 'more' ? asset.more.flatMap((k) => KIND_KEYS[k]) : KIND_KEYS[kind];
}

const isSet = (v: MapFilters[MapFilterKey]) =>
  Array.isArray(v) ? v.length > 0 : v !== null && v !== false;

export function isKindActive(kind: FilterKind, asset: AssetConfig, f: MapFilters): boolean {
  return keysOf(kind, asset).some((k) => isSet(f[k]));
}

/** Every key the asset's controls can set (the rest of the URL is ignored for this page). */
export function assetKeys(asset: AssetConfig): MapFilterKey[] {
  const kinds = new Set<FilterKind>([...asset.bar, ...asset.more, ...asset.sheet]);
  const keys = new Set<MapFilterKey>(['verifiedOnly']);
  for (const kind of kinds) for (const key of KIND_KEYS[kind]) keys.add(key);
  return [...keys];
}

/** Number of filter groups that are set — the badge on the mobile 필터 button. */
export function countActive(asset: AssetConfig, f: MapFilters): number {
  const groups = asset.sheet.filter((kind) => kind !== 'category' && isKindActive(kind, asset, f));
  return groups.length + (f.verifiedOnly ? 1 : 0);
}

export function pickKeys<K extends MapFilterKey>(
  f: MapFilters,
  keys: readonly K[],
): Pick<MapFilters, K> {
  const out = {} as Pick<MapFilters, K>;
  for (const key of keys) out[key] = f[key];
  return out;
}

const within = <T extends string>(values: readonly string[], allowed: readonly T[]): T[] =>
  allowed.filter((a) => values.includes(a));

/**
 * URL filters → query of `GET /map/search` and `GET /listings` (without bbox / zoom / sort).
 * Unknown enum values and keys the asset does not use are dropped, so a hand-edited URL can never
 * produce a 400.
 */
export function toApiFilters(
  asset: AssetConfig,
  f: MapFilters,
): Record<string, string | number | boolean | string[]> {
  const keys = new Set(assetKeys(asset));
  const out: Record<string, string | number | boolean | string[]> = {};
  const sub = within(f.assetTypes, asset.assetTypes);
  out.assetTypes = sub.length ? sub : [...asset.assetTypes];
  const put = (key: MapFilterKey, value: string[] | number | boolean | null) => {
    if (!keys.has(key) || value === null || value === false) return;
    if (Array.isArray(value) && value.length === 0) return;
    out[key] = value;
  };
  put('dealTypes', within(f.dealTypes, asset.dealTypes));
  for (const key of [
    'priceMin',
    'priceMax',
    'depositMin',
    'depositMax',
    'rentMin',
    'rentMax',
    'areaMin',
    'areaMax',
    'roomsMin',
    'bathsMin',
    'builtYearMin',
    'builtYearMax',
  ] as const) {
    const v = f[key];
    put(key, v !== null && Number.isFinite(v) && v >= 0 ? v : null);
  }
  put('directions', within(f.directions, Object.values(Direction)));
  put('floorClasses', within(f.floorClasses, Object.values(FloorClass)));
  put('options', within(f.options, Object.values(ListingOption)));
  put('roomTypes', within(f.roomTypes, Object.values(RoomType)));
  put('landZones', within(f.landZones, Object.values(LandZone)));
  put('landCategories', within(f.landCategories, Object.values(LandCategory)));
  put('verifiedOnly', f.verifiedOnly);
  return out;
}

// ---- scales -------------------------------------------------------------------------------------

/** Slider stops. Amounts in 만원, areas in 평 (converted to ㎡ for the URL / API). */
export const SCALES: Record<ScaleKey, readonly number[]> = {
  priceApt: [
    0, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000, 60000, 70000, 80000,
    100000,
  ],
  priceHouse: [0, 5000, 10000, 15000, 20000, 30000, 40000, 50000, 70000, 100000, 150000],
  priceShop: [0, 10000, 20000, 30000, 50000, 70000, 100000, 150000, 200000, 300000],
  priceLand: [0, 3000, 5000, 10000, 20000, 30000, 50000, 70000, 100000, 200000, 300000],
  depositApt: [0, 500, 1000, 2000, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 40000],
  depositRoom: [0, 100, 200, 300, 500, 1000, 2000, 3000, 5000, 10000, 15000],
  depositShop: [0, 500, 1000, 2000, 3000, 5000, 10000, 20000],
  rent: [0, 10, 20, 30, 40, 50, 60, 70, 80, 100, 150, 200],
  rentShop: [0, 50, 100, 150, 200, 300, 400, 500, 700, 1000],
  areaApt: [0, 10, 15, 20, 25, 30, 35, 40, 50, 60],
  areaRoom: [0, 5, 7, 10, 13, 15, 20, 25],
  areaShop: [0, 10, 20, 30, 50, 70, 100, 150, 200],
  areaLand: [0, 50, 100, 200, 300, 500, 1000, 2000, 3000],
};

/** Index of the stop closest to `value`; null → the open end (0 for a min, last for a max). */
export function scaleIndex(
  scale: readonly number[],
  value: number | null,
  end: 'min' | 'max',
): number {
  if (value === null) return end === 'min' ? 0 : scale.length - 1;
  let best = 0;
  scale.forEach((stop, i) => {
    if (Math.abs(stop - value) < Math.abs((scale[best] ?? 0) - value)) best = i;
  });
  return best;
}

/** Slider indices → [min, max] where the open ends are null. */
export function scaleRange(
  scale: readonly number[],
  lo: number,
  hi: number,
): [number | null, number | null] {
  return [
    lo <= 0 ? null : (scale[lo] ?? null),
    hi >= scale.length - 1 ? null : (scale[hi] ?? null),
  ];
}

export const areaToSqm = (pyeong: number) => pyeongToSqm(pyeong);
/** ㎡ range of the URL → whole 평 for the 평 scale. */
export const areaToPyeong = (sqm: number | null) =>
  sqm === null ? null : Math.round(sqmToPyeong(sqm, 2));

// ---- labels -------------------------------------------------------------------------------------

/** "5,000만", "3억", "4억 5,000" — amounts always carry their unit. */
export function amountLabel(manwon: number): string {
  return manwon < 10000 ? `${formatManwon(manwon)}만` : formatManwon(manwon);
}

/** Chip text of an amount range: "~ 1억", "30 ~ 50만", "3억 ~", "전체". */
export function amountRangeLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) {
    // Same magnitude under 1억 → write the unit once: "30 ~ 50만".
    return max < 10000
      ? `${formatManwon(min)} ~ ${formatManwon(max)}만`
      : `${amountLabel(min)} ~ ${amountLabel(max)}`;
  }
  if (min !== null) return `${amountLabel(min)} ~`;
  if (max !== null) return `~ ${amountLabel(max)}`;
  return '전체';
}

export function areaLabel(sqm: number, unit: AreaUnit): string {
  return unit === 'pyeong' ? `${Math.round(sqmToPyeong(sqm, 2))}평` : `${Math.round(sqm)}㎡`;
}

export function areaRangeLabel(min: number | null, max: number | null, unit: AreaUnit): string {
  if (min !== null && max !== null) return `${areaLabel(min, unit)} ~ ${areaLabel(max, unit)}`;
  if (min !== null) return `${areaLabel(min, unit)} ~`;
  if (max !== null) return `~ ${areaLabel(max, unit)}`;
  return '전체';
}

/** Short deal names for chips: 분양권 is written "분양" next to others (design: "분양·매매"). */
const DEAL_SHORT: Record<DealType, string> = { ...DEAL_TYPE_LABEL, PRESALE: '분양' };

function joinLabels<T extends string>(
  selected: readonly string[],
  order: readonly T[],
  label: Record<T, string>,
  max = 2,
): string {
  const picked = order.filter((o) => selected.includes(o));
  if (picked.length === 0 || picked.length === order.length) return '전체';
  const names = picked.slice(0, max).map((p) => label[p]);
  return picked.length > max ? `${names.join('·')} 외 ${picked.length - max}` : names.join('·');
}

export function dealLabel(asset: AssetConfig, f: MapFilters): string {
  const picked = asset.dealTypes.filter((d) => f.dealTypes.includes(d));
  if (picked.length === 0 || picked.length === asset.dealTypes.length) return '전체';
  if (picked.length === 1) return DEAL_TYPE_LABEL[picked[0] as DealType];
  return picked.map((d) => DEAL_SHORT[d]).join('·');
}

const minLabel = (v: number | null) => (v === null || v <= 0 ? '전체' : `${v}개 이상`);

/** Year the "N년 이내" presets are counted from (kept explicit so labels are testable). */
export function builtLabel(
  f: Pick<MapFilters, 'builtYearMin' | 'builtYearMax'>,
  thisYear: number,
): string {
  const { builtYearMin: min, builtYearMax: max } = f;
  if (min !== null && max === null) return `${thisYear - min}년 이내`;
  if (min === null && max !== null) return `${thisYear - max}년 이상`;
  if (min !== null && max !== null) return `${min}~${max}년`;
  return '전체';
}

/** Price chip: the first range that is set, with its name when it is not the sale price. */
export function priceLabel(f: MapFilters): string {
  const parts: string[] = [];
  if (f.priceMin !== null || f.priceMax !== null)
    parts.push(amountRangeLabel(f.priceMin, f.priceMax));
  if (f.depositMin !== null || f.depositMax !== null)
    parts.push(`보증금 ${amountRangeLabel(f.depositMin, f.depositMax)}`);
  if (f.rentMin !== null || f.rentMax !== null)
    parts.push(`월세 ${amountRangeLabel(f.rentMin, f.rentMax)}`);
  if (parts.length === 0) return '전체';
  return parts.length > 1 ? `${parts[0]} 외 ${parts.length - 1}` : (parts[0] as string);
}

/** Value text of a filter chip. */
export function chipLabel(
  kind: FilterKind,
  asset: AssetConfig,
  f: MapFilters,
  unit: AreaUnit,
  thisYear: number,
): string {
  switch (kind) {
    case 'category': {
      const sub = (asset.subTypes ?? []).filter((s) => f.assetTypes.includes(s.value));
      return sub.length === 1 ? (sub[0]?.label ?? asset.label) : asset.label;
    }
    case 'deal':
      return dealLabel(asset, f);
    case 'roomType':
      return joinLabels(f.roomTypes, Object.values(RoomType), ROOM_TYPE_LABEL);
    case 'area':
      return areaRangeLabel(f.areaMin, f.areaMax, unit);
    case 'price':
      return priceLabel(f);
    case 'deposit':
      return amountRangeLabel(f.depositMin, f.depositMax);
    case 'rent':
      return amountRangeLabel(f.rentMin, f.rentMax);
    case 'direction':
      return joinLabels(f.directions, Object.values(Direction), DIRECTION_LABEL);
    case 'rooms':
      return minLabel(f.roomsMin);
    case 'baths':
      return minLabel(f.bathsMin);
    case 'floor':
      return joinLabels(f.floorClasses, Object.values(FloorClass), FLOOR_CLASS_LABEL, 3);
    case 'built':
      return builtLabel(f, thisYear);
    case 'options':
    case 'quickOptions':
      return joinLabels(f.options, Object.values(ListingOption), LISTING_OPTION_LABEL);
    case 'landZone':
      return joinLabels(f.landZones, Object.values(LandZone), LAND_ZONE_LABEL);
    case 'landCategory':
      return joinLabels(f.landCategories, Object.values(LandCategory), LAND_CATEGORY_LABEL, 3);
    case 'more': {
      const n = asset.more.filter((k) => isKindActive(k, asset, f)).length;
      return n > 0 ? `${n}개 적용` : '전체';
    }
  }
}

export const KIND_LABEL: Record<FilterKind, string> = {
  category: '매물종류',
  deal: '거래방식',
  roomType: '방',
  area: '면적',
  price: '금액',
  deposit: '보증금',
  rent: '월세',
  direction: '방향',
  rooms: '방',
  baths: '욕실',
  floor: '층',
  built: '준공',
  options: '옵션',
  quickOptions: '옵션',
  landZone: '용도지역',
  landCategory: '지목',
  more: '추가 필터',
};

// ---- options ------------------------------------------------------------------------------------

/** "풀옵션" = 에어컨 + 냉장고 + 세탁기 (all three must be present). */
export const FULL_OPTION_SET: readonly ListingOption[] = [
  ListingOption.AIR_CONDITIONER,
  ListingOption.REFRIGERATOR,
  ListingOption.WASHER,
];

export const QUICK_OPTIONS: readonly {
  key: string;
  label: string;
  options: readonly ListingOption[];
}[] = [
  { key: 'full', label: '풀옵션', options: FULL_OPTION_SET },
  { key: 'parking', label: '주차', options: [ListingOption.PARKING] },
  { key: 'elevator', label: '엘리베이터', options: [ListingOption.ELEVATOR] },
  { key: 'pet', label: '반려동물', options: [ListingOption.PET_ALLOWED] },
];

export const hasOptions = (selected: readonly string[], options: readonly ListingOption[]) =>
  options.every((o) => selected.includes(o));

/** Toggles a quick option group on/off inside the `options` filter. */
export function toggleOptions(
  selected: readonly string[],
  options: readonly ListingOption[],
): string[] {
  if (hasOptions(selected, options))
    return selected.filter((s) => !options.includes(s as ListingOption));
  return [...selected, ...options.filter((o) => !selected.includes(o))];
}

export function toggleValue(selected: readonly string[], value: string): string[] {
  return selected.includes(value) ? selected.filter((s) => s !== value) : [...selected, value];
}

/** Options offered per asset in the 옵션 section (order = display order). */
export function optionChoices(asset: AssetConfig): readonly ListingOption[] {
  const O = ListingOption;
  switch (asset.slug) {
    case 'oneroom':
      return [
        O.AIR_CONDITIONER,
        O.REFRIGERATOR,
        O.WASHER,
        O.BED,
        O.DESK,
        O.CLOSET,
        O.INDUCTION,
        O.MICROWAVE,
        O.WIFI,
        O.ELEVATOR,
        O.PARKING,
        O.PET_ALLOWED,
        O.CCTV,
      ];
    case 'commercial':
      return [O.ELEVATOR, O.PARKING, O.AIR_CONDITIONER, O.CCTV, O.SECURITY];
    case 'house':
      return [
        O.PARKING,
        O.PET_ALLOWED,
        O.AIR_CONDITIONER,
        O.BUILT_IN_WARDROBE,
        O.VERANDA,
        O.GAS_RANGE,
      ];
    default:
      return [
        O.AIR_CONDITIONER,
        O.BUILT_IN_WARDROBE,
        O.INDUCTION,
        O.DISHWASHER,
        O.VERANDA,
        O.BALCONY,
        O.ELEVATOR,
        O.PARKING,
      ];
  }
}

export const BUILT_PRESETS: readonly { label: string; within?: number; over?: number }[] = [
  { label: '5년 이내', within: 5 },
  { label: '10년 이내', within: 10 },
  { label: '15년 이내', within: 15 },
  { label: '20년 이내', within: 20 },
  { label: '20년 이상', over: 20 },
];

export function builtPresetValue(
  preset: (typeof BUILT_PRESETS)[number],
  thisYear: number,
): Pick<MapFilters, 'builtYearMin' | 'builtYearMax'> {
  return preset.within !== undefined
    ? { builtYearMin: thisYear - preset.within, builtYearMax: null }
    : { builtYearMin: null, builtYearMax: thisYear - (preset.over ?? 0) };
}
