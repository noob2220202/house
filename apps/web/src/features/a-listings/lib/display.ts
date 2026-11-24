import {
  ASSET_TYPE_LABEL,
  AssetType,
  DEAL_TYPE_LABEL,
  DIRECTION_LABEL,
  DealType,
} from '@house/shared';
import type { DealKind } from '@house/ui';
import { formatDealPrice, formatFloor, formatPyeong, formatSqm } from '@/lib/format';
import type { AgencyListingItem, CoBrokerCandidate } from '../api/schemas';

export const DEAL_KIND: Record<DealType, DealKind> = {
  SALE: 'sale',
  JEONSE: 'jeonse',
  MONTHLY: 'monthly',
  PRESALE: 'presale',
};

type PriceFields = Pick<
  AgencyListingItem,
  'dealType' | 'salePrice' | 'deposit' | 'monthlyRent' | 'presalePrice' | 'premium'
>;

/** Headline amount in 만원 (분양권 = 분양가 + 프리미엄, 월세 = 보증금). Null while not entered. */
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

/** "4억 4,500" · "3,000/90" · "가격 미입력" (drafts). */
export function priceText(l: PriceFields): string {
  const amount = headlineAmount(l);
  if (l.dealType === DealType.MONTHLY) {
    if (l.monthlyRent === null || l.monthlyRent === undefined) return '가격 미입력';
  } else if (amount === null) return '가격 미입력';
  return formatDealPrice({
    dealType: l.dealType,
    price: l.dealType === DealType.MONTHLY ? null : amount,
    deposit: l.deposit ?? 0,
    monthlyRent: l.monthlyRent,
  });
}

type SpecFields = Pick<
  AgencyListingItem,
  | 'assetType'
  | 'exclusiveArea'
  | 'supplyArea'
  | 'floor'
  | 'totalFloors'
  | 'floorClass'
  | 'direction'
> & { landArea?: number | null };

/** "34평 · 20/25층 · 남향" — the broker sees the exact floor. */
export function specLine(l: SpecFields): string {
  const parts: string[] = [];
  if (l.assetType === AssetType.LAND) {
    if (l.landArea) parts.push(`대지 ${formatSqm(l.landArea)}`);
  } else {
    const area = l.supplyArea ?? l.exclusiveArea;
    if (area) parts.push(l.supplyArea ? formatPyeong(area) : `전용 ${formatSqm(area)}`);
    const floor = formatFloor({
      floor: l.floor,
      totalFloors: l.totalFloors,
      floorClass:
        l.floor === null || l.floor === undefined ? (l.floorClass ?? undefined) : undefined,
    });
    if (floor) parts.push(floor);
    if (l.direction) parts.push(DIRECTION_LABEL[l.direction]);
  }
  return parts.join(' · ');
}

/** "신대 레이크파크 1단지 103동" */
export function rowTitle(l: Pick<AgencyListingItem, 'name' | 'dong'>): string {
  return [l.name, l.dong].filter(Boolean).join(' ');
}

/** Screen-reader / dialog label: "신대 레이크파크 1단지 103동 · 매매 4억 4,500". */
export function rowLabel(l: AgencyListingItem | CoBrokerCandidate): string {
  return `${rowTitle(l)} · ${DEAL_TYPE_LABEL[l.dealType]} ${priceText(l)}`;
}

export const assetLabel = (t: AssetType) => ASSET_TYPE_LABEL[t];
