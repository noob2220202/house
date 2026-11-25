import { DEAL_TYPE_LABEL, DealType } from '@house/shared';
import { BRAND, josa } from '@/config/brand';
import type { MapAssetSlug } from '@/config/nav';
import { formatCount, formatDateKorean, formatPriceRange, formatSqm } from '@/lib/format';
import { LANDING_ASSETS, districtAlias } from '@/lib/seo/regions';
import type {
  SeoDealSummary,
  SeoRegion,
  SeoRegionLanding,
  SeoTradeReport,
} from '@/lib/seo/schemas';
import { dateOnlyLabel, manwonText, percentChange, ymDot, ymLabel } from '@/lib/seo/text';

/*
 * Factual copy of the w-seo pages, built only from API numbers. A sentence whose number is
 * missing is left out — never estimated.
 */

/** "순천시 해룡면 신대리(신대지구)" */
export function placeFull(region: Pick<SeoRegion, 'code' | 'emdName'>): string {
  const alias = districtAlias(region.emdName);
  return `${BRAND.region} ${region.emdName}${alias ? `(${alias})` : ''}`;
}

/** "(매매 14건 · 전세 12건 · 월세 9건)" — empty with fewer than two deal types. */
function dealBreakdown(deals: readonly SeoDealSummary[]): string {
  if (deals.length < 2) return '';
  return `(${deals.map((d) => `${DEAL_TYPE_LABEL[d.dealType]} ${formatCount(d.count)}건`).join(' · ')})`;
}

/** Asking-price range of one deal type in prose. */
export function dealRangeProse(d: SeoDealSummary): string | null {
  if (d.dealType === DealType.MONTHLY) {
    const deposit = formatPriceRange(d.minPrice, d.maxPrice);
    const rent =
      d.minRent !== null && d.maxRent !== null
        ? d.minRent === d.maxRent
          ? `월 ${formatCount(d.minRent)}만 원`
          : `월 ${formatCount(d.minRent)}~${formatCount(d.maxRent)}만 원`
        : null;
    if (!deposit && !rent) return null;
    return `월세는 ${[deposit ? `보증금 ${deposit}` : null, rent].filter(Boolean).join(', ')}`;
  }
  const range = formatPriceRange(d.minPrice, d.maxPrice);
  return range ? `${DEAL_TYPE_LABEL[d.dealType]} 호가는 ${range}` : null;
}

/** Intro paragraphs under the landing H1. */
export function landingIntro(landing: SeoRegionLanding, asset: MapAssetSlug): string[] {
  const cfg = LANDING_ASSETS[asset];
  const place = placeFull(landing.region);
  const asOf = formatDateKorean(landing.updatedAt);
  const { total, byDealType } = landing.listings;
  const out: string[] = [];

  const listingLine =
    total > 0
      ? `${place}에는 ${asOf} 기준 ${cfg.noun} 매물 ${formatCount(total)}건${dealBreakdown(byDealType)}이 ${BRAND.name}에 등록되어 있습니다.`
      : `${place}에 ${asOf} 기준 등록된 ${cfg.noun} 매물은 없습니다.`;
  const complexLine =
    cfg.complexes && landing.complexTotal > 0
      ? ` 이 지역 아파트·오피스텔 단지 ${formatCount(landing.complexTotal)}곳의 단지 정보와 실거래가를 함께 볼 수 있습니다.`
      : '';
  out.push(listingLine + complexLine);

  const ranges = byDealType.map(dealRangeProse).filter((s): s is string => s !== null);
  if (ranges.length > 0) out.push(`${ranges.join(', ')} 수준입니다(만 원 단위, 중개사 제시 호가).`);

  const t = landing.trades;
  if (cfg.complexes && t) {
    const period = `최근 12개월(${ymDot(t.fromYm)}~${ymDot(t.toYm)})`;
    if (t.sale.count > 0) {
      const prices = [
        t.sale.avgPrice !== null ? `평균 거래가는 ${manwonText(t.sale.avgPrice)}` : null,
        t.sale.medianPrice !== null ? `중위 거래가는 ${manwonText(t.sale.medianPrice)}` : null,
      ].filter(Boolean);
      let line = `${period} 국토교통부 실거래가 기준 이 지역 아파트 매매는 ${formatCount(t.sale.count)}건${
        prices.length ? `이며 ${prices.join(', ')}입니다.` : '입니다.'
      }`;
      if (t.sale.avgPricePerPyeong !== null) {
        line += ` 전용면적 3.3㎡당 평균 거래가는 ${manwonText(t.sale.avgPricePerPyeong)}입니다.`;
      }
      if (t.jeonse.count > 0 && t.jeonse.medianDeposit !== null) {
        line += ` 같은 기간 전세 거래는 ${formatCount(t.jeonse.count)}건, 중위 보증금은 ${manwonText(t.jeonse.medianDeposit)}입니다.`;
      }
      out.push(line);
    } else {
      out.push(`${period} 동안 이 지역에서 신고된 아파트 매매 실거래는 없습니다.`);
    }
  }
  return out;
}

/** Meta description of a landing page (≤ 160 chars after clipping). */
export function landingDescription(landing: SeoRegionLanding, asset: MapAssetSlug): string {
  const cfg = LANDING_ASSETS[asset];
  const place = placeFull(landing.region);
  const parts = [`${place} ${cfg.noun} 매물 ${formatCount(landing.listings.total)}건`];
  const t = landing.trades;
  if (cfg.complexes && t && t.sale.count > 0) {
    parts.push(`최근 12개월 매매 실거래 ${formatCount(t.sale.count)}건`);
    if (t.sale.medianPrice !== null) parts.push(`중위 ${manwonText(t.sale.medianPrice)}`);
  }
  if (cfg.complexes && landing.complexTotal > 0) {
    parts.push(`단지 ${formatCount(landing.complexTotal)}곳 시세`);
  }
  return `${parts.join(' · ')}. 국토교통부 실거래가와 공인중개사 등록 매물로 보는 ${place} ${cfg.topic}.`;
}

/** "전용 84.99㎡ · 3층" */
export function tradeSpec(t: { exclusiveArea: number; floor: number | null }): string {
  return [`전용 ${formatSqm(t.exclusiveArea)}`, t.floor !== null ? `${t.floor}층` : null]
    .filter(Boolean)
    .join(' · ');
}

export type Trend = { text: string; direction: 'up' | 'down' | 'flat' } | null;

/** "전월 대비 +51.9%" */
export function trendOf(current: number | null, base: number | null, label: string): Trend {
  const pct = percentChange(current, base);
  if (!pct || current === null || base === null) return null;
  return {
    text: `${label} ${pct}`,
    direction: current > base ? 'up' : current < base ? 'down' : 'flat',
  };
}

/** Lead paragraphs of the monthly report. */
export function reportLead(report: SeoTradeReport): string[] {
  const s = report.sale;
  const month = ymLabel(report.yearMonth);
  const out: string[] = [];
  let first = `${month} ${report.regionName} 아파트 매매 실거래는 ${formatCount(s.count)}건입니다`;
  const prev = report.previous;
  if (prev) {
    const pct = percentChange(s.count, prev.sale.count);
    if (pct) first += `(전월 ${formatCount(prev.sale.count)}건 대비 ${pct})`;
  }
  first += '.';
  const prices = [
    s.avgPrice !== null ? `평균 거래가 ${manwonText(s.avgPrice)}` : null,
    s.medianPrice !== null ? `중위 거래가 ${manwonText(s.medianPrice)}` : null,
    s.avgPricePerPyeong !== null ? `전용 3.3㎡당 평균 ${manwonText(s.avgPricePerPyeong)}` : null,
  ].filter(Boolean);
  if (prices.length) first += ` ${prices.join(', ')}입니다.`;
  out.push(first);
  const top = report.byRegion[0];
  if (top && top.sale.count > 0) {
    out.push(
      `거래가 가장 많은 곳은 ${josa(top.name, '으로', '로')} ${formatCount(top.sale.count)}건${
        top.sale.medianPrice !== null ? `, 중위 거래가 ${manwonText(top.sale.medianPrice)}` : ''
      }입니다.`,
    );
  }
  if (report.yearAgo) {
    const pct = percentChange(s.count, report.yearAgo.sale.count);
    if (pct) {
      out.push(
        `1년 전(${ymLabel(report.yearAgo.yearMonth)}) ${formatCount(report.yearAgo.sale.count)}건과 비교하면 거래량은 ${pct}입니다.`,
      );
    }
  }
  return out;
}

/** "2026년 11월 17일 · 전용 59.92㎡ · 16층 · 2억 6,150만 원" (llms / FAQ prose). */
export function tradeProse(t: {
  dealDate: string;
  exclusiveArea: number;
  floor: number | null;
  price: number;
}): string {
  return `${dateOnlyLabel(t.dealDate)} ${tradeSpec(t)} ${manwonText(t.price)}`;
}
