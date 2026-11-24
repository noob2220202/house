import { ASSET_TYPE_LABEL, DealType } from '@house/shared';
import { formatBuiltYear, formatCount, formatPriceRange } from '@/lib/format';
import type { ComplexDetail, DealSummary } from '../api/schemas';

export interface Fact {
  label: string;
  value: string;
}

/** 사용승인일 "2019-06-28" → "2019.06" (null without one). */
export function approvalMonth(c: Pick<ComplexDetail, 'approvalDate'>): string | null {
  const m = c.approvalDate ? /^(\d{4})-(\d{2})/.exec(c.approvalDate) : null;
  return m ? `${m[1]}.${m[2]}` : null;
}

/**
 * Completion as a phrase: "2019.06 준공" from the 사용승인일, otherwise the shared
 * `formatBuiltYear` ("2019년 준공" · "2027년 입주 예정").
 */
export function completionLabel(
  c: Pick<ComplexDetail, 'approvalDate' | 'builtYear'>,
  now: Date = new Date(),
): string | null {
  const month = approvalMonth(c);
  if (month) return `${month} 준공`;
  return c.builtYear === null ? null : formatBuiltYear(c.builtYear, now);
}

/** Label / value cell of the completion fact ("준공 2019.06", "입주 예정 2027년"). */
function completionFact(
  c: Pick<ComplexDetail, 'approvalDate' | 'builtYear'>,
  approvalLabel: string,
): Fact | null {
  const month = approvalMonth(c);
  if (month) return { label: approvalLabel, value: month };
  if (c.builtYear === null) return null;
  const future = formatBuiltYear(c.builtYear).endsWith('예정');
  return { label: future ? '입주 예정' : '준공', value: `${c.builtYear}년` };
}

const trimNumber = (n: number, digits = 2) =>
  n.toLocaleString('ko-KR', { maximumFractionDigits: digits });

/** The one-line facts under the panel title: 세대수 · 준공 · 동수 · 주차 · 용적률 (missing ones are skipped). */
export function complexFacts(c: ComplexDetail): Fact[] {
  const facts: Fact[] = [];
  if (c.households !== null) facts.push({ label: '세대수', value: formatCount(c.households) });
  const done = completionFact(c, '준공');
  if (done) facts.push(done);
  if (c.buildings !== null) facts.push({ label: '동수', value: `${c.buildings}개동` });
  if (c.parkingPerHousehold !== null)
    facts.push({ label: '주차', value: `${trimNumber(c.parkingPerHousehold)}대` });
  if (c.floorAreaRatio !== null)
    facts.push({ label: '용적률', value: `${trimNumber(c.floorAreaRatio, 1)}%` });
  return facts;
}

/** Full fact table of the complex page (단지 개요). */
export function complexOverview(c: ComplexDetail): Fact[] {
  const rows: (Fact | null)[] = [
    c.households !== null ? { label: '세대수', value: `${formatCount(c.households)}세대` } : null,
    c.buildings !== null ? { label: '동수', value: `${c.buildings}개동` } : null,
    completionFact(c, '사용승인'),
    c.floorsMax !== null
      ? {
          label: '층수',
          value:
            c.floorsMin !== null && c.floorsMin !== c.floorsMax
              ? `${c.floorsMin}~${c.floorsMax}층`
              : `${c.floorsMax}층`,
        }
      : null,
    c.parkingTotal !== null || c.parkingPerHousehold !== null
      ? {
          label: '주차',
          value: [
            c.parkingTotal !== null ? `총 ${formatCount(c.parkingTotal)}대` : '',
            c.parkingPerHousehold !== null ? `세대당 ${trimNumber(c.parkingPerHousehold)}대` : '',
          ]
            .filter(Boolean)
            .join(' · '),
        }
      : null,
    c.floorAreaRatio !== null
      ? { label: '용적률', value: `${trimNumber(c.floorAreaRatio, 1)}%` }
      : null,
    c.buildingCoverageRatio !== null
      ? { label: '건폐율', value: `${trimNumber(c.buildingCoverageRatio, 1)}%` }
      : null,
    c.heatingType ? { label: '난방', value: c.heatingType } : null,
    c.builder ? { label: '건설사', value: c.builder } : null,
    { label: '유형', value: ASSET_TYPE_LABEL[c.assetType] },
  ];
  return rows.filter((r): r is Fact => r !== null);
}

/** "해룡면 신대리 신대 레이크파크 1단지 …" meta description for the complex page. */
export function complexDescription(c: ComplexDetail, listingCount?: number): string {
  const parts = [
    `${c.emdName ? `${c.emdName} ` : ''}${c.name}`,
    c.households !== null ? `${formatCount(c.households)}세대` : '',
    completionLabel(c) ?? '',
    c.areaTypes.length
      ? `${c.areaTypes
          .map((a) => a.pyeongLabel)
          .filter(Boolean)
          .join('·')}`
      : '',
  ].filter(Boolean);
  const tail =
    listingCount && listingCount > 0
      ? ` 실거래가와 매매·전세·월세 매물 ${formatCount(listingCount)}건을 확인하세요.`
      : ' 실거래가와 단지 정보를 확인하세요.';
  return `${parts.join(' · ')}.${tail}`;
}

/** Straight-line distance for lists: 1400 → "1.4km", 320 → "320m". */
export function formatDistance(m: number): string {
  return m >= 1000
    ? `${(Math.round(m / 100) / 10).toLocaleString('ko-KR')}km`
    : `${Math.round(m)}m`;
}

/**
 * "3억 9,000 ~ 4억 8,500". 월세 shows the two ranges separately — "보증금 3,000 ~ 5,000 · 월 80~90" —
 * because the cheapest deposit and the cheapest rent usually belong to different listings, and a
 * paired "3,000/90" would quote a price no listing has.
 */
export function dealRangeText(d: DealSummary): string {
  if (d.dealType === DealType.MONTHLY && d.rentMin !== null && d.rentMax !== null) {
    const deposit = formatPriceRange(d.priceMin, d.priceMax);
    const rent = d.rentMin === d.rentMax ? `${d.rentMin}` : `${d.rentMin}~${d.rentMax}`;
    return deposit ? `보증금 ${deposit} · 월 ${rent}` : `월 ${rent}`;
  }
  return formatPriceRange(d.priceMin, d.priceMax) || '가격 협의';
}
