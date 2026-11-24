import { DEAL_TYPE_LABEL, DIRECTION_LABEL, DealType, sqmToPyeong } from '@house/shared';
import { dealKindOf, type DealKind } from '@house/ui';
import {
  formatDealPrice,
  formatFloor,
  formatManwon,
  formatMonthly,
  formatPerPyeong,
  type AreaUnit,
  type DealPrice,
} from '@/lib/format';
import {
  LAND_CATEGORY_LABEL,
  LAND_ZONE_LABEL,
  ROOM_TYPE_LABEL,
  type ListingSummary,
} from '../api/schemas';
import { listingDisplayName } from '@/lib/api/schemas/listing';

type PriceFields = Pick<
  ListingSummary,
  'dealType' | 'salePrice' | 'deposit' | 'monthlyRent' | 'presalePrice' | 'premium'
>;

/** Raw price columns → the foundation's `DealPrice` (분양권 headline = 분양가 + 프리미엄). */
export function dealPriceOf(l: PriceFields): DealPrice {
  switch (l.dealType) {
    case DealType.SALE:
      return { dealType: l.dealType, price: l.salePrice };
    case DealType.PRESALE:
      return {
        dealType: l.dealType,
        price:
          l.presalePrice === null || l.presalePrice === undefined
            ? null
            : l.presalePrice + (l.premium ?? 0),
      };
    case DealType.JEONSE:
      return { dealType: l.dealType, price: l.deposit };
    default:
      return { dealType: l.dealType, deposit: l.deposit, monthlyRent: l.monthlyRent };
  }
}

/** "4억 4,500" · "500/42" · "9,500". */
export const priceText = (l: PriceFields) => formatDealPrice(dealPriceOf(l));
/** "매매 4억 4,500" — for accessible names. */
export const priceTextLabeled = (l: PriceFields) =>
  `${DEAL_TYPE_LABEL[l.dealType]} ${priceText(l)}`;
export const dealKind = (l: Pick<ListingSummary, 'dealType'>): DealKind => dealKindOf(l.dealType);

/**
 * Compact 억 for map markers: two decimals, **truncated** — a pin must never print more than the
 * listing costs (2억 9,500 → "2.95억", not "3억"; 1억 3,500 → "1.35억"; 4억 4,000 → "4.4억").
 * Under 1억 the amount stays in 만원 ("9,500만").
 */
export function formatMarkerPrice(manwon: number): string {
  if (!Number.isFinite(manwon)) return '';
  const abs = Math.abs(Math.trunc(manwon));
  const sign = manwon < 0 ? '-' : '';
  if (abs < 10000) return `${sign}${abs.toLocaleString('ko-KR')}만`;
  return `${sign}${(Math.floor(abs / 100) / 100).toLocaleString('ko-KR', { maximumFractionDigits: 2 })}억`;
}

/** Compact marker text: "500/42" (월세), "9,500" (전세 under 1억), "2.95억". */
export function markerPriceText(l: PriceFields): string {
  const p = dealPriceOf(l);
  if (p.dealType === DealType.MONTHLY) {
    return p.monthlyRent === null || p.monthlyRent === undefined
      ? '협의'
      : formatMonthly(p.deposit ?? 0, p.monthlyRent);
  }
  if (p.price === null || p.price === undefined) return '협의';
  return p.price < 10000 ? formatManwon(p.price) : formatMarkerPrice(p.price);
}

/** Complex / building name, falling back to the broker's headline (the shared rule). */
export const listingName = (l: ListingSummary): string => listingDisplayName(l);

/** Last word of the 법정동 ("해룡면 신대리" → "신대리"). */
export function shortEmd(emdName: string | null | undefined): string {
  return emdName?.trim().split(/\s+/).pop() ?? '';
}

export function areaText(sqm: number, unit: AreaUnit): string {
  return unit === 'pyeong' ? `${Math.round(sqmToPyeong(sqm, 2))}평` : `${Math.round(sqm)}㎡`;
}

export function floorText(l: ListingSummary): string {
  return formatFloor({
    floor: l.floor,
    totalFloors: l.totalFloors,
    floorClass: l.floor === null || l.floor === undefined ? l.floorClass : undefined,
    showExact: l.floor !== null && l.floor !== undefined,
  });
}

/** 관리비 5만 — whole 만원, or null when unknown / none. */
export function feeText(won: number | null | undefined): string | null {
  if (won === null || won === undefined) return null;
  if (won === 0) return '관리비 없음';
  return `관리비 ${Math.round(won / 10_000).toLocaleString('ko-KR')}만`;
}

/** 토지 평당가: "690만/평" (매매 only). */
export function perPyeongText(l: ListingSummary): string | null {
  if (!l.landArea || l.exclusiveArea || !l.salePrice) return null;
  const pyeong = sqmToPyeong(l.landArea, 2);
  return pyeong > 0 ? formatPerPyeong(l.salePrice / pyeong) : null;
}

const clean = (parts: readonly (string | null | undefined | false)[]) =>
  parts.filter((p): p is string => typeof p === 'string' && p.length > 0);

/**
 * Fact chips of a listing card, per asset type. `fee: false` leaves 관리비 out (photo cards print
 * it next to the price so the facts stay on one line).
 */
export function listingMeta(
  l: ListingSummary,
  unit: AreaUnit,
  { fee = true }: { fee?: boolean } = {},
): string[] {
  const exclusive = l.exclusiveArea ? `전용 ${areaText(l.exclusiveArea, unit)}` : null;
  if (l.complexId) {
    const area =
      unit === 'pyeong' && l.pyeongLabel
        ? `${l.pyeongLabel}평`
        : l.supplyArea
          ? areaText(l.supplyArea, unit)
          : exclusive;
    return clean([l.dong, floorText(l), area, l.direction && DIRECTION_LABEL[l.direction]]);
  }
  if (l.landArea && !l.exclusiveArea) {
    const perPyeong = fee ? perPyeongText(l) : null;
    return clean([
      l.landCategory ? `지목 ${LAND_CATEGORY_LABEL[l.landCategory]}` : l.kindLabel,
      areaText(l.landArea, unit),
      l.landZone && LAND_ZONE_LABEL[l.landZone],
      perPyeong,
    ]);
  }
  if (l.roomType) {
    return clean([
      ROOM_TYPE_LABEL[l.roomType],
      exclusive,
      floorText(l),
      fee && feeText(l.maintenanceFeeWon),
    ]);
  }
  return clean([
    l.kindLabel,
    exclusive,
    l.rooms ? `방 ${l.rooms}` : null,
    floorText(l),
    fee && l.maintenanceFeeWon ? feeText(l.maintenanceFeeWon) : null,
  ]);
}

/** Lighter second line: "석현동 · 2019년 준공 · 해오름빌". */
export function listingSub(l: ListingSummary): string {
  const name = l.complexName ?? l.buildingName;
  return clean([
    shortEmd(l.emdName),
    l.builtYear ? `${l.builtYear}년 준공` : null,
    name ?? (l.landArea && l.exclusiveArea ? `대지 ${areaText(l.landArea, 'pyeong')}` : null),
  ]).join(' · ');
}
