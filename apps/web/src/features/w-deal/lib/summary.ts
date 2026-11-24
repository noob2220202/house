import {
  ASSET_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DealRequestType,
  DealType,
  type AssetType,
} from '@house/shared';
import {
  formatAreaBoth,
  formatDateKorean,
  formatManwon,
  formatMonthly,
  formatPriceRange,
  formatSqm,
} from '@/lib/format';
import type { DealRequest } from '../api/schemas';
import { bandLabelFor } from './find-form';
import { regionSummary } from './regions';
import { displayAddress } from './service-area';

/** Display helpers for a DealRequest (list rows, detail header, completion page). */

const has = (n: number | null | undefined): n is number => typeof n === 'number';

/** Card title: complex / address for 내놓기, "연향동 · 조례동 아파트" for 구하기. */
export function requestTitle(r: DealRequest): string {
  if (r.type === DealRequestType.SELL_OR_LEASE)
    return r.complexName || displayAddress(r.roadAddress) || ASSET_TYPE_LABEL[r.assetType];
  const regions = regionSummary(r.regionCodes);
  return `${regions ? `${regions} ` : ''}${ASSET_TYPE_LABEL[r.assetType]}`;
}

/** Second line: private detail address (owner view) or the wanted conditions. */
export function requestSubtitle(r: DealRequest): string {
  if (r.type === DealRequestType.SELL_OR_LEASE) {
    return [
      r.complexName ? displayAddress(r.roadAddress) : null,
      r.addressDetail,
      requestAreaText(r),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return [
    requestAreaText(r),
    has(r.roomsMin) ? `방 ${r.roomsMin}개 이상` : null,
    r.moveInDate ? `${formatDateKorean(r.moveInDate)} 입주 희망` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface PriceLine {
  label: string;
  value: string;
}

/** Price lines: 희망가 for 내놓기, budget ranges for 구하기 (only the ones that were given). */
export function requestPriceLines(r: DealRequest): PriceLine[] {
  const lines: PriceLine[] = [];
  if (r.type === DealRequestType.SELL_OR_LEASE) {
    const deal = r.dealTypes[0];
    if (has(r.desiredSalePrice))
      lines.push({
        label: deal === DealType.PRESALE ? '희망 분양권 매매가' : '희망 매매가',
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
  const range = (min?: number | null, max?: number | null) => {
    const text = formatPriceRange(min, max);
    return has(max) && !has(min) ? `${formatManwon(max)} 이하` : text;
  };
  if (has(r.priceMin) || has(r.priceMax))
    lines.push({ label: '매매 예산', value: range(r.priceMin, r.priceMax) });
  if (has(r.depositMin) || has(r.depositMax))
    lines.push({ label: '보증금', value: range(r.depositMin, r.depositMax) });
  if (has(r.rentMin) || has(r.rentMax))
    lines.push({ label: '월세', value: range(r.rentMin, r.rentMax) });
  return lines;
}

export function requestAreaText(r: DealRequest): string {
  if (r.type === DealRequestType.SELL_OR_LEASE)
    return has(r.exclusiveArea) ? `전용 ${formatAreaBoth(r.exclusiveArea)}` : '';
  // 구하기 ranges are 전용 ㎡. "평" alone means 공급 평형, so 평 is only shown as the band label
  // ("20~30평대") when the range is made of the form's whole 평형 bands.
  if (!has(r.areaMin) && !has(r.areaMax)) return '';
  const n = (x: number) => formatSqm(x).replace('㎡', '');
  const text =
    has(r.areaMin) && has(r.areaMax)
      ? `전용 ${n(r.areaMin)}~${n(r.areaMax)}㎡`
      : has(r.areaMin)
        ? `전용 ${formatSqm(r.areaMin)} 이상`
        : `전용 ${formatSqm(r.areaMax ?? 0)} 이하`;
  const band = bandLabelFor(r.areaMin, r.areaMax);
  return band ? `${band} (${text})` : text;
}

export function requestDealLabels(r: Pick<DealRequest, 'dealTypes'>): string {
  return r.dealTypes.map((d) => DEAL_TYPE_LABEL[d]).join(' · ');
}

/**
 * Splits a description into the flag lines the form prepends ("· 가격 협의 가능") and the free text.
 * Mirrors `composeDescription` in sell-form.ts.
 */
export function splitDescription(description: string | null | undefined): {
  flags: string[];
  text: string;
} {
  if (!description) return { flags: [], text: '' };
  const lines = description.split('\n');
  const flags: string[] = [];
  let i = 0;
  while (i < lines.length && /^·\s/.test(lines[i] ?? '')) {
    flags.push((lines[i] ?? '').replace(/^·\s*/, ''));
    i += 1;
  }
  return { flags, text: lines.slice(i).join('\n').trim() };
}

export const assetLabel = (assetType: AssetType) => ASSET_TYPE_LABEL[assetType];
