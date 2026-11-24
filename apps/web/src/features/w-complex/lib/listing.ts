import { DIRECTION_LABEL, DealType } from '@house/shared';
import { dealKindOf, type DealKind, type PhotoKind } from '@house/ui';
import {
  formatDateShort,
  formatDealPrice,
  formatFloor,
  formatManwon,
  formatPyeong,
  type AreaUnit,
} from '@/lib/format';
import type { ComplexAreaType, ComplexListingItem, ListingAgency } from '../api/schemas';

type PriceFields = Pick<
  ComplexListingItem,
  'dealType' | 'salePrice' | 'deposit' | 'monthlyRent' | 'presalePrice' | 'premium'
>;

/** Headline amount in 만원: 매매가 · 분양가+프리미엄 · 보증금. */
export function headlineAmount(l: PriceFields): number | null {
  switch (l.dealType) {
    case DealType.SALE:
      return l.salePrice ?? null;
    case DealType.PRESALE:
      return l.presalePrice === null || l.presalePrice === undefined
        ? null
        : l.presalePrice + (l.premium ?? 0);
    default:
      return l.deposit ?? null;
  }
}

export interface ListingHeadline {
  deal: DealKind;
  /** "4억 4,500" · "3,000/90" · "가격 협의" */
  price: string;
  /** Upper bound when co-brokering offices advertise different prices: "4억 3,000". */
  priceTo: string | null;
}

export function listingHeadline(l: ComplexListingItem): ListingHeadline {
  const deal = dealKindOf(l.dealType);
  if (l.dealType === DealType.MONTHLY) {
    return {
      deal,
      price: formatDealPrice({
        dealType: l.dealType,
        deposit: l.deposit,
        monthlyRent: l.monthlyRent,
      }),
      priceTo: null,
    };
  }
  const amount = headlineAmount(l);
  const hasRange = l.priceMin !== null && l.priceMax !== null && l.priceMax > l.priceMin;
  if (hasRange)
    return { deal, price: formatManwon(l.priceMin!), priceTo: formatManwon(l.priceMax!) };
  return { deal, price: amount === null ? '가격 협의' : formatManwon(amount), priceTo: null };
}

/** "34" or "34평" (either convention) → "34평". */
export function pyeongText(label: string | null | undefined): string | null {
  return label ? `${label.replace(/평$/, '')}평` : null;
}

/** Whole ㎡ like the design ("전용 84㎡" for 84.98㎡ — truncated, the way 평형 names are read). */
export const wholeSqm = (sqm: number) => `${Math.floor(sqm)}㎡`;

export interface ListingSpecs {
  dong: string | null;
  floor: string;
  /** "34평" (평) or "112㎡" (㎡) — the supply-area size the 평형 is known by. */
  area: string;
  /** "전용 84㎡" */
  exclusive: string;
  direction: string;
  /** "방3·욕2" */
  rooms: string;
}

export function listingSpecs(l: ComplexListingItem, unit: AreaUnit): ListingSpecs {
  const supply = l.supplyArea ?? l.exclusiveArea;
  const area =
    unit === 'pyeong'
      ? (pyeongText(l.pyeongLabel) ?? (supply ? formatPyeong(supply) : ''))
      : supply
        ? wholeSqm(supply)
        : '';
  const rooms = [l.rooms ? `방${l.rooms}` : '', l.baths ? `욕${l.baths}` : '']
    .filter(Boolean)
    .join('·');
  return {
    dong: l.dong ?? null,
    floor: formatFloor({
      floor: l.floor,
      totalFloors: l.totalFloors,
      floorClass: l.floorClass ?? undefined,
      showExact: l.floorDisplay === 'EXACT' && l.floor !== null,
    }),
    area,
    exclusive: l.exclusiveArea ? `전용 ${wholeSqm(l.exclusiveArea)}` : '',
    direction: l.direction ? DIRECTION_LABEL[l.direction] : '',
    rooms,
  };
}

/** Hint under a row whose co-brokering offices advertise different prices (design: Complex). */
export const PRICE_RANGE_HINT = '중개사무소마다 호가가 달라요';

/** Listing number quoted to an office (same fallback as the listing page: first 8 id chars). */
export function listingNo(l: Pick<ComplexListingItem, 'id'>): string {
  return l.id.slice(0, 8).toUpperCase();
}

/** "103동 34평 매매 4억 4,500" — accessible name of a row / popover. */
export function listingLabel(l: ComplexListingItem): string {
  const h = listingHeadline(l);
  return [
    l.dong,
    pyeongText(l.pyeongLabel),
    DEAL_LABEL[h.deal],
    h.priceTo ? `${h.price} ~ ${h.priceTo}` : h.price,
  ]
    .filter(Boolean)
    .join(' ');
}

const DEAL_LABEL: Record<DealKind, string> = {
  sale: '매매',
  jeonse: '전세',
  monthly: '월세',
  presale: '분양권',
};

/** Right-hand caption of the co-broker popover: "호가 모두 4억 4,500" / "호가 4억 2,000 ~ 4억 3,000". */
export function askingSummary(l: ComplexListingItem): string {
  const h = listingHeadline(l);
  if (h.priceTo) return `호가 ${h.price} ~ ${h.priceTo}`;
  return l.agencies.length > 1 ? `호가 모두 ${h.price}` : `호가 ${h.price}`;
}

/** Second line of an office in the popover: "대표 김서진 · 이 단지 매물 18 · 응답 12분". */
export function agencyMeta(a: ListingAgency): { ceo: string | null; rest: string } {
  const rest = [
    a.complexListingCount !== null
      ? `이 단지 매물 ${a.complexListingCount.toLocaleString('ko-KR')}`
      : '',
    a.avgResponseMinutes !== null ? `응답 ${a.avgResponseMinutes}분` : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return { ceo: a.representativeName ? `대표 ${a.representativeName}` : null, rest };
}

/** Placeholder illustration when a listing has no photo — varied but stable per listing. */
export function placeholderKind(id: string): PhotoKind {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 3 === 0 ? 'room' : 'tower';
}

export const verifiedLabel = (iso: string | null) => (iso ? formatDateShort(iso) : null);

/** 평형 name in the chosen unit: "34평" / "112㎡". */
export function areaTypeLabel(a: ComplexAreaType, unit: AreaUnit = 'pyeong'): string {
  const supply = a.supplyArea ?? a.exclusiveArea;
  return unit === 'pyeong' ? (a.pyeongLabel ?? formatPyeong(supply)) : wholeSqm(supply);
}
