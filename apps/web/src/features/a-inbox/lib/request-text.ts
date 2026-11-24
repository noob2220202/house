import {
  ASSET_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DealRequestType,
  DealType,
  type DealRequestVisibility,
} from '@house/shared';
import { regionName, regionSummary } from '@/features/w-deal/lib/regions';
import {
  formatAreaBoth,
  formatDateKorean,
  formatManwon,
  formatMonthly,
  formatPriceRange,
  formatPyeong,
} from '@/lib/format';
import type { AgencyDealRequest } from '../api/schemas';

/** Display helpers for a request as an agency sees it (no private address, no contact). */

const has = (n: number | null | undefined): n is number => typeof n === 'number';

export function dealLabels(r: Pick<AgencyDealRequest, 'dealTypes'>): string {
  return r.dealTypes.map((d) => DEAL_TYPE_LABEL[d]).join('·');
}

/** Where: 단지 / 읍면동 for 내놓기, wanted regions for 구하기. */
export function requestPlace(r: AgencyDealRequest): string {
  if (r.type === DealRequestType.SELL_OR_LEASE) {
    return r.complexName || [r.emdName, ASSET_TYPE_LABEL[r.assetType]].filter(Boolean).join(' ');
  }
  const regions = regionSummary(r.regionCodes);
  return [regions, ASSET_TYPE_LABEL[r.assetType]].filter(Boolean).join(' ');
}

/** Row / page title: "신대 레이크파크 1단지 · 매매", "신대지구 아파트 · 매매·전세". */
export function requestTitle(r: AgencyDealRequest): string {
  return `${requestPlace(r)} · ${dealLabels(r)}`;
}

export function requestAreaText(r: AgencyDealRequest): string {
  if (r.type === DealRequestType.SELL_OR_LEASE)
    return has(r.exclusiveArea) ? `전용 ${formatAreaBoth(r.exclusiveArea)}` : '';
  if (has(r.areaMin) && has(r.areaMax))
    return `전용 ${formatPyeong(r.areaMin)}~${formatPyeong(r.areaMax)}`;
  if (has(r.areaMin)) return `전용 ${formatPyeong(r.areaMin)} 이상`;
  if (has(r.areaMax)) return `전용 ${formatPyeong(r.areaMax)} 이하`;
  return '';
}

/** Second line of a row: asset · area · floor / rooms · move-in. */
export function requestSubtitle(r: AgencyDealRequest): string {
  const sell = r.type === DealRequestType.SELL_OR_LEASE;
  return [
    sell && r.complexName ? ASSET_TYPE_LABEL[r.assetType] : null,
    sell && r.complexName ? r.emdName : null,
    requestAreaText(r),
    sell && has(r.floor) ? `${r.floor}층` : null,
    !sell && has(r.roomsMin) ? `방 ${r.roomsMin}개 이상` : null,
    r.moveInDate ? `${formatDateKorean(r.moveInDate)} 입주${sell ? ' 가능' : ' 희망'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface PriceLine {
  label: string;
  value: string;
}

const upTo = (min?: number | null, max?: number | null) =>
  has(max) && !has(min) ? `${formatManwon(max)} 이하` : formatPriceRange(min, max);

/** 희망가 (내놓기) or budget ranges (구하기) — only what the requester filled in. */
export function requestPriceLines(r: AgencyDealRequest): PriceLine[] {
  const lines: PriceLine[] = [];
  if (r.type === DealRequestType.SELL_OR_LEASE) {
    if (has(r.desiredSalePrice))
      lines.push({
        label: r.dealTypes[0] === DealType.PRESALE ? '희망 분양권 매매가' : '희망 매매가',
        value: formatManwon(r.desiredSalePrice),
      });
    else if (has(r.desiredMonthlyRent))
      lines.push({
        label: '희망 보증금/월세',
        value: formatMonthly(r.desiredDeposit ?? 0, r.desiredMonthlyRent),
      });
    else if (has(r.desiredDeposit))
      lines.push({ label: '희망 전세가', value: formatManwon(r.desiredDeposit) });
    return lines;
  }
  if (has(r.priceMin) || has(r.priceMax))
    lines.push({ label: '매매 예산', value: upTo(r.priceMin, r.priceMax) });
  if (has(r.depositMin) || has(r.depositMax))
    lines.push({ label: '보증금', value: upTo(r.depositMin, r.depositMax) });
  if (has(r.rentMin) || has(r.rentMax))
    lines.push({ label: '월세', value: upTo(r.rentMin, r.rentMax) });
  return lines;
}

/**
 * The one price shown on a list row. 월세 budgets collapse to "보증금/월세 1,000/60 이하"; other
 * multi-line budgets show the first line and how many more there are.
 */
export function requestHeadlinePrice(r: AgencyDealRequest): PriceLine | null {
  const lines = requestPriceLines(r);
  const first = lines[0];
  if (!first) return null;
  if (
    r.type === DealRequestType.WANTED &&
    lines.length === 2 &&
    has(r.depositMax) &&
    has(r.rentMax) &&
    !has(r.depositMin) &&
    !has(r.rentMin)
  ) {
    return {
      label: '보증금/월세',
      value: `${formatMonthly(r.depositMax, r.rentMax)} 이하`,
    };
  }
  return lines.length > 1
    ? { label: `${first.label} 외 ${lines.length - 1}`, value: first.value }
    : first;
}

/** Names of the wanted regions + complexes ("신대지구", "선월 하이츠 2차"). */
export function wantedPlaces(r: Pick<AgencyDealRequest, 'regionCodes' | 'complexNames'>): string[] {
  return [...r.regionCodes.map(regionName), ...r.complexNames];
}

export const VISIBILITY_TEXT: Record<DealRequestVisibility, string> = {
  ALL_AGENCIES_IN_REGION: '지역 중개사무소 전체',
  SELECTED_AGENCIES: '요청자가 고른 중개사무소',
};

/**
 * Splits a description into the flag lines the 내놓기 form prepends ("· 가격 협의 가능") and the
 * free text (same convention as w-deal's `composeDescription`).
 */
export function splitFlags(text: string | null | undefined): { flags: string[]; text: string } {
  if (!text) return { flags: [], text: '' };
  const lines = text.split('\n');
  const flags: string[] = [];
  let i = 0;
  while (i < lines.length && /^·\s/.test(lines[i] ?? '')) {
    flags.push((lines[i] ?? '').replace(/^·\s*/, '').trim());
    i += 1;
  }
  return { flags, text: lines.slice(i).join('\n').trim() };
}
