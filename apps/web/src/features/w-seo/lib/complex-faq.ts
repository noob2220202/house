import { DEAL_TYPE_LABEL, DealType } from '@house/shared';
import { BRAND, josa } from '@/config/brand';
import type {
  ComplexDetail,
  ComplexListingSummary,
  TradeRecord,
} from '@/features/w-complex/api/schemas';
import {
  formatCount,
  formatDateKorean,
  formatPriceRange,
  formatPyeong,
  formatSqm,
} from '@/lib/format';
import { DISTRICT_ALIASES } from '@/lib/seo/regions';
import { dateOnlyLabel, manwonText } from '@/lib/seo/text';

export interface FaqItem {
  question: string;
  answer: string;
}

const DEAL_ORDER: DealType[] = [DealType.PRESALE, DealType.SALE, DealType.JEONSE, DealType.MONTHLY];

/** "2019년 6월" from 사용승인일 "2019-06-28". */
function approvalLabel(date: string | null): string | null {
  const m = date ? /^(\d{4})-(\d{2})/.exec(date) : null;
  return m ? `${m[1]}년 ${Number(m[2])}월` : null;
}

/** Newest non-cancelled trade of a deal type among the 평형-latest rows. */
export function newestTrade(
  trades: readonly TradeRecord[],
  dealType: TradeRecord['dealType'],
): TradeRecord | null {
  return (
    trades
      .filter((t) => t.dealType === dealType && !t.cancelled && (t.price ?? t.deposit) !== null)
      .sort((a, b) => (a.dealDate < b.dealDate ? 1 : a.dealDate > b.dealDate ? -1 : 0))[0] ?? null
  );
}

export interface ComplexFaqInput {
  complex: ComplexDetail;
  listings: ComplexListingSummary | null;
  /** Latest trade per 평형 × deal type (stats.latest + complex.latestTrades). */
  latest: readonly TradeRecord[];
  /** When the page data was read (listing counts are "as of"). */
  asOf: Date;
}

/**
 * Factual Q&A of a 단지 page (준공, 세대수·평형, 최근 실거래, 현재 매물, 위치). Questions whose
 * facts are missing are left out.
 */
export function complexFaq({ complex: c, listings, latest, asOf }: ComplexFaqInput): FaqItem[] {
  const name = c.name;
  const items: FaqItem[] = [];
  const alias = c.emdCode ? DISTRICT_ALIASES[c.emdCode] : undefined;
  const place = [BRAND.region, c.emdName].filter(Boolean).join(' ') + (alias ? `(${alias})` : '');

  // 준공
  const approval = approvalLabel(c.approvalDate);
  if (approval || c.builtYear !== null) {
    const when = approval ? `${approval} 사용승인(준공)` : `${c.builtYear}년 준공`;
    const scale = [
      c.households !== null ? `${formatCount(c.households)}세대` : null,
      c.buildings !== null ? `${c.buildings}개 동` : null,
      c.floorsMax !== null ? `최고 ${c.floorsMax}층` : null,
    ].filter(Boolean);
    items.push({
      question: `${josa(name, '은', '는')} 언제 준공됐나요?`,
      answer: `${josa(name, '은', '는')} ${when}된 ${scale.length ? `${scale.join(', ')} 규모의 ` : ''}단지입니다.`,
    });
  }

  // 세대수 · 평형
  if (c.areaTypes.length > 0 || c.households !== null) {
    const types = [...c.areaTypes]
      .sort((a, b) => a.exclusiveArea - b.exclusiveArea)
      .map(
        (a) =>
          `전용 ${formatSqm(a.exclusiveArea)}(${a.pyeongLabel ?? formatPyeong(a.supplyArea ?? a.exclusiveArea)}${
            a.households !== null ? `, ${formatCount(a.households)}세대` : ''
          })`,
      );
    const parts = [
      c.households !== null ? `총 ${formatCount(c.households)}세대` : null,
      types.length ? `평형은 ${types.join(', ')} ${types.length}개 타입` : null,
    ].filter(Boolean);
    items.push({
      question: `${name} 세대수와 평형은 어떻게 되나요?`,
      answer: `${parts.join('이며, ')}입니다.`,
    });
  }

  // 최근 실거래
  const sale = newestTrade(latest, 'SALE');
  const jeonse = newestTrade(latest, 'JEONSE');
  if (sale || jeonse) {
    const line = (t: TradeRecord, label: string) =>
      `${label}는 ${dateOnlyLabel(t.dealDate)} 전용 ${formatSqm(t.exclusiveArea)}${
        t.floor !== null ? ` ${t.floor}층` : ''
      } ${manwonText((t.price ?? t.deposit) as number)}`;
    const parts = [sale ? line(sale, '가장 최근 매매') : null, jeonse ? line(jeonse, '전세') : null]
      .filter(Boolean)
      .join(', ');
    items.push({
      question: `${name} 최근 실거래가는 얼마인가요?`,
      answer: `국토교통부 실거래가 기준 ${parts}입니다. 평형별 전체 거래 내역은 이 페이지의 실거래가 표에서 볼 수 있습니다.`,
    });
  }

  // 현재 매물
  if (listings) {
    const deals = DEAL_ORDER.flatMap((t) => {
      const d = listings.byDealType.find((x) => x.dealType === t);
      return d && d.count > 0 ? [d] : [];
    });
    const asOfText = formatDateKorean(asOf);
    items.push({
      question: `${name} 매물은 지금 몇 건 있나요?`,
      answer:
        listings.total > 0
          ? `${asOfText} 기준 ${BRAND.name}에 등록된 매물은 ${formatCount(listings.total)}건입니다(${deals
              .map((d) => {
                const range =
                  d.dealType === DealType.MONTHLY && d.rentMin !== null && d.rentMax !== null
                    ? `보증금 ${formatPriceRange(d.priceMin, d.priceMax)}, 월 ${d.rentMin === d.rentMax ? d.rentMin : `${d.rentMin}~${d.rentMax}`}만 원`
                    : formatPriceRange(d.priceMin, d.priceMax);
                return `${DEAL_TYPE_LABEL[d.dealType]} ${formatCount(d.count)}건${range ? ` ${range}` : ''}`;
              })
              .join(', ')}). 가격은 만 원 단위 중개사 제시 호가입니다.`
          : `${asOfText} 기준 ${BRAND.name}에 등록된 매물은 없습니다. 구하기 요청을 남기면 이 지역 중개사무소가 맞는 매물을 제안합니다.`,
    });
  }

  // 위치
  const address = c.roadAddress ?? c.jibunAddress;
  if (address || c.emdName) {
    items.push({
      question: `${josa(name, '은', '는')} 어디에 있나요?`,
      answer: `${place}에 있으며 주소는 ${address ?? place}입니다.`,
    });
  }
  return items;
}
