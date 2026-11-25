import { DEAL_TYPE_LABEL, formatManwon } from '@house/shared';
import { dealKindOf, type DealKind } from '@house/ui';
import { listingPriceText } from '@/features/w-home/lib/listing-card';
import { listingDisplayName, type ListingSummary } from '@/lib/api/schemas/listing';
import { formatAreaPair } from '@/lib/format/area';
import { formatDateShort } from '@/lib/format/date';
import type { SeoTradeReport } from '@/lib/seo/schemas';

/**
 * Facts of the two floating cards on the login brand panel. Everything here comes from the API —
 * the cards never show sample data: no listing and no 실거래 → no first card, no approved office
 * count → no second card.
 */

/** The newest public listing that passed 실매물 확인. Never carries 동 / 호. */
export interface BrandListingFact {
  kind: 'listing';
  /** 단지명 / 건물명 / 종류 ("listingDisplayName" without the broker headline). */
  title: string;
  /** "전용 85㎡(26평)" — empty when the listing has no area. */
  area: string;
  deal: DealKind;
  dealLabel: string;
  /** "4억 4,500" · "500/42" */
  price: string;
  /** 실매물 확인일 "26.11.22". */
  verifiedDate: string;
  brokerCount: number;
}

/** 국토교통부 실거래 of the 단지 with the most 매매 trades in the latest reported month. */
export interface BrandTradeFact {
  kind: 'trade';
  /** 단지명 as reported by 국토교통부. */
  title: string;
  emdName: string | null;
  /** "2026년 10월" (계약월). */
  monthLabel: string;
  tradeCount: number;
  /** 중위 거래가 "4억 4,500". */
  medianPrice: string;
}

export interface BrandPanelFacts {
  highlight: BrandListingFact | BrandTradeFact | null;
  /** Approved 중개사무소 of the site (GET /home/summary agencyCount); null = unknown or 0. */
  agencyCount: number | null;
}

/** 전용 (아파트·주택·상가) → 공급 → 대지 area, as "전용 85㎡(26평)". */
export function listingAreaText(
  l: Pick<ListingSummary, 'exclusiveArea' | 'supplyArea' | 'landArea'>,
): string {
  if (l.exclusiveArea) return `전용 ${formatAreaPair(l.exclusiveArea)}`;
  if (l.supplyArea) return `공급 ${formatAreaPair(l.supplyArea)}`;
  if (l.landArea) return `대지 ${formatAreaPair(l.landArea)}`;
  return '';
}

export function toListingFact(l: ListingSummary): BrandListingFact | null {
  // Only a listing that actually passed 실매물 확인 may be shown as one.
  if (!l.verifiedAt) return null;
  const verifiedDate = formatDateShort(l.verifiedAt);
  if (!verifiedDate) return null;
  return {
    kind: 'listing',
    // Never the broker's free-text headline: it may name a 동 / 호 ("103동 로얄층 급매").
    title: listingDisplayName({ ...l, title: null }),
    area: listingAreaText(l),
    deal: dealKindOf(l.dealType),
    dealLabel: DEAL_TYPE_LABEL[l.dealType],
    price: listingPriceText(l),
    verifiedDate,
    brokerCount: Math.max(1, l.agencyCount),
  };
}

/** 202610 → "2026년 10월". */
export function formatYearMonth(ym: number): string {
  const year = Math.trunc(ym / 100);
  const month = ym % 100;
  return `${year}년 ${month}월`;
}

export function toTradeFact(report: SeoTradeReport): BrandTradeFact | null {
  const top = report.topComplexes.find(
    (c) => c.count > 0 && c.medianPrice !== null && c.medianPrice > 0,
  );
  if (!top || top.medianPrice === null) return null;
  return {
    kind: 'trade',
    title: top.name,
    emdName: top.emdName,
    monthLabel: formatYearMonth(report.yearMonth),
    tradeCount: top.count,
    medianPrice: formatManwon(top.medianPrice),
  };
}

export function toBrandPanelFacts(input: {
  listing: ListingSummary | undefined;
  report: SeoTradeReport | null | undefined;
  agencyCount: number | null | undefined;
}): BrandPanelFacts {
  const listing = input.listing ? toListingFact(input.listing) : null;
  const trade = !listing && input.report ? toTradeFact(input.report) : null;
  const count = input.agencyCount;
  return {
    highlight: listing ?? trade,
    agencyCount: typeof count === 'number' && count > 0 ? count : null,
  };
}
