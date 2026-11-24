import { manwonToWon } from './money';

/**
 * 중개보수 (brokerage commission) calculator.
 *
 * The fee table is DATA (`BROKERAGE_FEE_SCHEDULE`) so it can be swapped when the 시행규칙 / 조례
 * changes, or later be served by the back-office. All thresholds are in 만원, rates in %.
 */

export type FeePropertyKind = 'HOUSING' | 'OFFICETEL' | 'OTHER';
export type FeeDealKind = 'SALE' | 'JEONSE' | 'MONTHLY' | 'PRESALE';

export interface FeeBracket {
  /** Exclusive upper bound of 거래금액 in 만원; `null` = no upper bound. */
  under: number | null;
  /** 상한요율 (%). */
  ratePct: number;
  /** 한도액 in 만원 (only the low brackets have one). */
  capManwon?: number;
}

export interface BrokerageFeeSchedule {
  /** Shown under the table: which rule set this is. */
  label: string;
  effectiveFrom: string;
  housing: { sale: readonly FeeBracket[]; lease: readonly FeeBracket[] };
  /** 주거용 오피스텔 (전용 85㎡ 이하, 부엌·화장실 등 설비 구비). */
  officetel: { saleRatePct: number; leaseRatePct: number };
  /** 주택 외 (토지, 상가, 그 밖의 오피스텔): 협의, 상한만 정해져 있다. */
  other: { maxRatePct: number };
  /** 월세 환산: 보증금 + 월세 × multiplier; 환산액이 lowThreshold 미만이면 lowMultiplier. */
  monthly: { multiplier: number; lowMultiplier: number; lowThresholdManwon: number };
  vatRatePct: number;
}

/** 공인중개사법 시행규칙 별표 1 (2021.10.19 시행) — 전라남도 조례도 같은 상한요율을 따른다. */
export const BROKERAGE_FEE_SCHEDULE: BrokerageFeeSchedule = {
  label: '공인중개사법 시행규칙 별표 1 · 전라남도 주택 중개보수 조례',
  effectiveFrom: '2021-10-19',
  housing: {
    sale: [
      { under: 5_000, ratePct: 0.6, capManwon: 25 },
      { under: 20_000, ratePct: 0.5, capManwon: 80 },
      { under: 90_000, ratePct: 0.4 },
      { under: 120_000, ratePct: 0.5 },
      { under: 150_000, ratePct: 0.6 },
      { under: null, ratePct: 0.7 },
    ],
    lease: [
      { under: 5_000, ratePct: 0.5, capManwon: 20 },
      { under: 10_000, ratePct: 0.4, capManwon: 30 },
      { under: 60_000, ratePct: 0.3 },
      { under: 120_000, ratePct: 0.4 },
      { under: 150_000, ratePct: 0.5 },
      { under: null, ratePct: 0.6 },
    ],
  },
  officetel: { saleRatePct: 0.5, leaseRatePct: 0.4 },
  other: { maxRatePct: 0.9 },
  monthly: { multiplier: 100, lowMultiplier: 70, lowThresholdManwon: 5_000 },
  vatRatePct: 10,
};

export interface BrokerageFeeInput {
  property: FeePropertyKind;
  deal: FeeDealKind;
  /** 매매가 / 전세 보증금 (만원). For PRESALE: 실제 납입한 금액 (계약금 + 중도금 등). */
  price?: number;
  /** 월세 보증금 (만원). */
  deposit?: number;
  /** 월세 (만원). */
  monthlyRent?: number;
  /** 분양권 프리미엄 (만원, may be negative). */
  premium?: number;
  /** 협의한 요율 (%). Ignored when above the legal maximum. */
  negotiatedRatePct?: number;
  /** Add VAT (일반과세자 10%). */
  includeVat?: boolean;
}

export interface BrokerageFeeResult {
  /** 거래금액 used for the table lookup (만원) — 월세는 환산보증금, 분양권은 납입금 + 프리미엄. */
  transactionAmount: number;
  /** Multiplier used for the 월세 환산 (100 or 70); undefined for other deals. */
  monthlyMultiplier?: number;
  /** Legal maximum rate (%) of the matched bracket. */
  maxRatePct: number;
  /** Rate actually applied (%): min(negotiated, max). */
  appliedRatePct: number;
  /** 한도액 (만원) of the matched bracket, if any. */
  capManwon?: number;
  /** True when the cap, not the rate, decided the fee. */
  capped: boolean;
  /** Index into the housing bracket list (undefined for officetel/other). */
  bracketIndex?: number;
  /** True for 주택 외: the fee is negotiated within the maximum. */
  negotiable: boolean;
  /** 중개보수 (원, 부가세 제외). */
  feeWon: number;
  vatWon: number;
  totalWon: number;
}

/** 월세 → 환산 거래금액 (만원). */
export function monthlyTransactionAmount(
  deposit: number,
  monthlyRent: number,
  schedule: BrokerageFeeSchedule = BROKERAGE_FEE_SCHEDULE,
): { amount: number; multiplier: number } {
  const { multiplier, lowMultiplier, lowThresholdManwon } = schedule.monthly;
  const standard = deposit + monthlyRent * multiplier;
  if (standard < lowThresholdManwon) {
    return { amount: deposit + monthlyRent * lowMultiplier, multiplier: lowMultiplier };
  }
  return { amount: standard, multiplier };
}

export function findBracketIndex(brackets: readonly FeeBracket[], amountManwon: number): number {
  const i = brackets.findIndex((b) => b.under === null || amountManwon < b.under);
  return i === -1 ? brackets.length - 1 : i;
}

const nonNegative = (n: number | undefined): number =>
  n !== undefined && Number.isFinite(n) && n > 0 ? n : 0;

/**
 * Maximum (or negotiated) brokerage fee for one side of the deal.
 * Returns null when the inputs do not make a positive 거래금액.
 */
export function calculateBrokerageFee(
  input: BrokerageFeeInput,
  schedule: BrokerageFeeSchedule = BROKERAGE_FEE_SCHEDULE,
): BrokerageFeeResult | null {
  const isSaleLike = input.deal === 'SALE' || input.deal === 'PRESALE';

  let transactionAmount: number;
  let monthlyMultiplier: number | undefined;
  if (input.deal === 'MONTHLY') {
    const m = monthlyTransactionAmount(
      nonNegative(input.deposit),
      nonNegative(input.monthlyRent),
      schedule,
    );
    transactionAmount = m.amount;
    monthlyMultiplier = m.multiplier;
  } else if (input.deal === 'PRESALE') {
    const premium = Number.isFinite(input.premium) ? (input.premium ?? 0) : 0;
    transactionAmount = nonNegative(input.price) + premium;
  } else {
    transactionAmount = nonNegative(input.price);
  }
  if (!(transactionAmount > 0)) return null;

  let maxRatePct: number;
  let capManwon: number | undefined;
  let bracketIndex: number | undefined;
  let negotiable = false;

  if (input.property === 'HOUSING') {
    const brackets = isSaleLike ? schedule.housing.sale : schedule.housing.lease;
    bracketIndex = findBracketIndex(brackets, transactionAmount);
    const bracket = brackets[bracketIndex]!;
    maxRatePct = bracket.ratePct;
    capManwon = bracket.capManwon;
  } else if (input.property === 'OFFICETEL') {
    maxRatePct = isSaleLike ? schedule.officetel.saleRatePct : schedule.officetel.leaseRatePct;
  } else {
    maxRatePct = schedule.other.maxRatePct;
    negotiable = true;
  }

  const negotiated = input.negotiatedRatePct;
  const appliedRatePct =
    negotiated !== undefined && Number.isFinite(negotiated) && negotiated > 0
      ? Math.min(negotiated, maxRatePct)
      : maxRatePct;

  // Integer arithmetic: 만원 × (rate × 1000) → 원 (rate has at most 3 decimals).
  const byRate = Math.floor(
    (manwonToWon(transactionAmount) * Math.round(appliedRatePct * 1000)) / 100_000,
  );
  const capWon = capManwon !== undefined ? manwonToWon(capManwon) : undefined;
  const capped = capWon !== undefined && byRate > capWon;
  const feeWon = capped ? capWon : byRate;
  const vatWon = input.includeVat ? Math.floor((feeWon * schedule.vatRatePct) / 100) : 0;

  return {
    transactionAmount,
    monthlyMultiplier,
    maxRatePct,
    appliedRatePct,
    capManwon,
    capped,
    bracketIndex,
    negotiable,
    feeWon,
    vatWon,
    totalWon: feeWon + vatWon,
  };
}

/** "5천만원 미만", "2억원 이상 ~ 9억원 미만", "15억원 이상" for the schedule table. */
export function bracketRangeLabel(brackets: readonly FeeBracket[], index: number): string {
  const label = (manwon: number): string => {
    const eok = Math.floor(manwon / 10_000);
    const rest = manwon % 10_000;
    if (eok === 0)
      return rest % 1_000 === 0 ? `${rest / 1_000}천만원` : `${rest.toLocaleString('ko-KR')}만원`;
    if (rest === 0) return `${eok}억원`;
    return rest % 1_000 === 0
      ? `${eok}억 ${rest / 1_000}천만원`
      : `${eok}억 ${rest.toLocaleString('ko-KR')}만원`;
  };
  const upper = brackets[index]?.under ?? null;
  const lower = index > 0 ? (brackets[index - 1]?.under ?? null) : null;
  if (lower === null && upper !== null) return `${label(upper)} 미만`;
  if (lower !== null && upper === null) return `${label(lower)} 이상`;
  if (lower !== null && upper !== null) return `${label(lower)} 이상 ~ ${label(upper)} 미만`;
  return '전체';
}
