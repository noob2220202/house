import { DEAL_TYPE_LABEL, DealType, formatManwon } from '@house/shared';

export { formatManwon };

/** Price fields of a listing. All amounts are integer 만원. */
export interface DealPrice {
  dealType: DealType;
  /** 매매가 / 전세 보증금 / 분양권 매매가. */
  price?: number | null;
  /** 월세 보증금. */
  deposit?: number | null;
  /** 월세 (월 차임). */
  monthlyRent?: number | null;
}

/** 월세 "500/45" (보증금/월세). */
export function formatMonthly(deposit: number, monthlyRent: number): string {
  return `${formatManwon(deposit)}/${monthlyRent.toLocaleString('ko-KR')}`;
}

/**
 * Headline price of a listing: "4억 4,500" (매매·전세·분양권), "500/45" (월세).
 * Returns "가격 협의" when the amount is missing.
 */
export function formatDealPrice(p: DealPrice): string {
  if (p.dealType === DealType.MONTHLY) {
    if (p.monthlyRent === null || p.monthlyRent === undefined) return '가격 협의';
    return formatMonthly(p.deposit ?? 0, p.monthlyRent);
  }
  const amount = p.price ?? p.deposit;
  if (amount === null || amount === undefined) return '가격 협의';
  return formatManwon(amount);
}

/** Price with its deal label: "매매 4억 4,500", "전세 2억 1,000", "월세 500/45". */
export function formatDealPriceLabeled(p: DealPrice): string {
  return `${DEAL_TYPE_LABEL[p.dealType]} ${formatDealPrice(p)}`;
}

/**
 * Compact price for map markers and chips: 44500 → "4.4억", 30000 → "3억", 9500 → "9,500만", 125000 → "12.5억".
 * Rounds to one decimal 억 (half up).
 */
export function formatPriceShort(manwon: number): string {
  if (!Number.isFinite(manwon)) return '';
  const abs = Math.abs(Math.trunc(manwon));
  const sign = manwon < 0 ? '-' : '';
  if (abs < 10000) return `${sign}${abs.toLocaleString('ko-KR')}만`;
  const eok = Math.round(abs / 1000) / 10;
  return `${sign}${Number.isInteger(eok) ? eok.toLocaleString('ko-KR') : eok.toFixed(1)}억`;
}

/** "3억 9,000 ~ 4억 8,500"; open-ended: "3억 9,000~" / "~ 4억 8,500"; equal bounds collapse. */
export function formatPriceRange(min?: number | null, max?: number | null): string {
  const hasMin = min !== null && min !== undefined;
  const hasMax = max !== null && max !== undefined;
  if (hasMin && hasMax)
    return min === max ? formatManwon(min) : `${formatManwon(min)} ~ ${formatManwon(max)}`;
  if (hasMin) return `${formatManwon(min)}~`;
  if (hasMax) return `~ ${formatManwon(max)}`;
  return '';
}

/** Filter chip label for a price range in 만원: "3억~5억", "3억 이상", "5억 이하", "전체". */
export function formatPriceFilter(min?: number | null, max?: number | null): string {
  const hasMin = min !== null && min !== undefined && min > 0;
  const hasMax = max !== null && max !== undefined;
  const unit = (v: number) => (v < 10000 ? `${formatManwon(v)}만` : formatManwon(v));
  if (hasMin && hasMax) return `${unit(min)}~${unit(max)}`;
  if (hasMin) return `${unit(min)} 이상`;
  if (hasMax) return `${unit(max)} 이하`;
  return '전체';
}

/** 평당가: 1180 → "1,180만/평". */
export function formatPerPyeong(manwonPerPyeong: number): string {
  return `${Math.round(manwonPerPyeong).toLocaleString('ko-KR')}만/평`;
}

/** 분양권 premium chip text: 2700 → "P +2,700", -1200 → "P -1,200". */
export function formatPremium(manwon: number): string {
  return `P ${manwon >= 0 ? '+' : '-'}${Math.abs(manwon).toLocaleString('ko-KR')}`;
}

/**
 * Parses what users type into a price field to 만원: "4억 2,000" → 42000, "4.5억" → 45000,
 * "9500" → 9500, "3억" → 30000, "2천" → 2000. Returns null when it cannot be parsed.
 */
export function parsePriceInput(input: string): number | null {
  const s = input.replace(/[\s,]/g, '').replace(/만원?$/, '');
  if (s === '') return null;
  const m = /^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)천)?(\d+)?$/.exec(s);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  const total = Number(m[1] ?? 0) * 10000 + Number(m[2] ?? 0) * 1000 + Number(m[3] ?? 0);
  return Number.isFinite(total) ? Math.round(total) : null;
}

/** Live hint under a price input: 42000 → "4억 2,000만원". */
export function formatPriceHint(manwon: number | null): string {
  if (manwon === null || manwon <= 0) return '';
  return `${formatManwon(manwon)}${manwon % 10000 === 0 ? '원' : '만원'}`;
}

/** 관리비 in 원 → "15만원", "8만 5천원", "없음". */
export function formatMaintenanceFee(won: number | null | undefined): string {
  if (won === null || won === undefined) return '확인 필요';
  if (won === 0) return '없음';
  const man = Math.floor(won / 10000);
  const cheon = Math.round((won % 10000) / 1000);
  if (man === 0) return `${won.toLocaleString('ko-KR')}원`;
  return cheon > 0
    ? `${man.toLocaleString('ko-KR')}만 ${cheon}천원`
    : `${man.toLocaleString('ko-KR')}만원`;
}
