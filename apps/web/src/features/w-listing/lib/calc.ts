import { AssetType, DealType } from '@house/shared';

/**
 * Estimates shown in "이 가격으로 계산해 보기". All money is integer 만원 unless noted.
 * These are guidance figures (상한요율 / 표준 세율) — the UI always labels them as estimates.
 */

// ---- 중개보수 (공인중개사법 시행규칙 별표 1, 2021.10.19 시행) -----------------------------------

export interface BrokerageFee {
  /** 거래금액 used for the bracket (월세는 환산보증금). */
  base: number;
  /** 상한요율 in % (0.4 → 0.4%). */
  ratePct: number;
  /** 한도액 (만원) when the bracket has one. */
  cap: number | null;
  /** Maximum fee in 만원 (VAT excluded), rounded down to 1천원 units (0.1만원). */
  fee: number;
  /** True when the rate is a negotiable ceiling without a statutory table (상가·토지 등). */
  negotiable: boolean;
}

interface Bracket {
  /** Exclusive upper bound of the bracket in 만원. */
  under: number;
  ratePct: number;
  cap: number | null;
}

const HOUSING_SALE: readonly Bracket[] = [
  { under: 5_000, ratePct: 0.6, cap: 25 },
  { under: 20_000, ratePct: 0.5, cap: 80 },
  { under: 90_000, ratePct: 0.4, cap: null },
  { under: 120_000, ratePct: 0.5, cap: null },
  { under: 150_000, ratePct: 0.6, cap: null },
  { under: Infinity, ratePct: 0.7, cap: null },
];
const HOUSING_LEASE: readonly Bracket[] = [
  { under: 5_000, ratePct: 0.5, cap: 20 },
  { under: 10_000, ratePct: 0.4, cap: 30 },
  { under: 60_000, ratePct: 0.3, cap: null },
  { under: 120_000, ratePct: 0.4, cap: null },
  { under: 150_000, ratePct: 0.5, cap: null },
  { under: Infinity, ratePct: 0.6, cap: null },
];

/**
 * 월세 거래금액: 보증금 + 월세 × 100. 그 합이 5천만원 미만이면 보증금 + 월세 × 70.
 */
export function monthlyTransactionAmount(deposit: number, monthlyRent: number): number {
  const base = deposit + monthlyRent * 100;
  return base < 5_000 ? deposit + monthlyRent * 70 : base;
}

const floor1 = (v: number) => Math.floor(v * 10 + 1e-6) / 10;

export interface BrokerageInput {
  assetType: AssetType;
  dealType: DealType;
  /** 매매가 / 전세 보증금 / 분양권 거래가액 (만원). */
  price?: number | null;
  /** 월세 보증금 (만원). */
  deposit?: number | null;
  monthlyRent?: number | null;
}

export function brokerageFee(input: BrokerageInput): BrokerageFee | null {
  const lease = input.dealType === DealType.JEONSE || input.dealType === DealType.MONTHLY;
  const base =
    input.dealType === DealType.MONTHLY
      ? monthlyTransactionAmount(input.deposit ?? 0, input.monthlyRent ?? 0)
      : (input.price ?? input.deposit ?? 0);
  if (!Number.isFinite(base) || base <= 0) return null;

  // 주택 외(상가·토지 등): 0.9% 이내 협의. 주거용 오피스텔(전용 85㎡ 이하): 매매 0.5% · 임대차 0.4%.
  if (input.assetType === AssetType.COMMERCIAL || input.assetType === AssetType.LAND) {
    return { base, ratePct: 0.9, cap: null, fee: floor1((base * 0.9) / 100), negotiable: true };
  }
  if (input.assetType === AssetType.OFFICETEL) {
    const ratePct = lease ? 0.4 : 0.5;
    return { base, ratePct, cap: null, fee: floor1((base * ratePct) / 100), negotiable: false };
  }
  const table = lease ? HOUSING_LEASE : HOUSING_SALE;
  const bracket = table.find((b) => base < b.under) ?? table[table.length - 1]!;
  const raw = (base * bracket.ratePct) / 100;
  const fee = floor1(bracket.cap !== null ? Math.min(raw, bracket.cap) : raw);
  return { base, ratePct: bracket.ratePct, cap: bracket.cap, fee, negotiable: false };
}

// ---- 대출 이자 (원리금균등상환) ---------------------------------------------------------------

export interface LoanResult {
  /** Monthly payment in 만원 (1 decimal). */
  monthly: number;
  /** Total interest over the term in 만원. */
  totalInterest: number;
}

/** Equal monthly payment of an amortizing loan. `principal` in 만원, rate in % per year. */
export function loanPayment(
  principal: number,
  annualRatePct: number,
  years: number,
): LoanResult | null {
  const n = Math.round(years * 12);
  if (!(principal > 0) || !(n > 0) || annualRatePct < 0) return null;
  const r = annualRatePct / 100 / 12;
  const monthly = r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n);
  return {
    monthly: Math.round(monthly * 10) / 10,
    totalInterest: Math.max(0, Math.round(monthly * n - principal)),
  };
}

/** Default loan principal: LTV 70% of the price, rounded to 10만원. */
export function defaultLoanPrincipal(price: number, ltvPct = 70): number {
  return Math.round((price * ltvPct) / 100 / 10) * 10;
}

// ---- 취득세 (주택 유상취득, 1주택 기준 표준세율) ----------------------------------------------

export interface AcquisitionTax {
  /** 취득세율 % */
  ratePct: number;
  /** 취득세 + 지방교육세 (+ 농어촌특별세) in 만원. */
  total: number;
  acquisition: number;
  localEducation: number;
  ruralSpecial: number;
  /** Combined effective rate in %. */
  effectivePct: number;
}

/**
 * 1주택자가 주택을 살 때의 취득세 추정:
 * 6억 이하 1% · 6억~9억 (취득가액×2/3억 − 3)% · 9억 초과 3%, 지방교육세 = 취득세율의 1/10,
 * 전용 85㎡ 초과면 농어촌특별세 0.2%. 주택 외(상가·토지)는 4% + 지방교육세 0.4% + 농특세 0.2%.
 */
export function acquisitionTax(
  price: number,
  options: { exclusiveAreaSqm?: number | null; housing?: boolean } = {},
): AcquisitionTax | null {
  if (!(price > 0)) return null;
  const housing = options.housing ?? true;
  let ratePct: number;
  let eduPct: number;
  let ruralPct: number;
  if (!housing) {
    ratePct = 4;
    eduPct = 0.4;
    ruralPct = 0.2;
  } else {
    if (price <= 60_000) ratePct = 1;
    else if (price <= 90_000)
      ratePct = Math.round(((price / 10_000) * (2 / 3) - 3) * 10_000) / 10_000;
    else ratePct = 3;
    eduPct = ratePct / 10;
    ruralPct = (options.exclusiveAreaSqm ?? 0) > 85 ? 0.2 : 0;
  }
  const acquisition = Math.round((price * ratePct) / 100);
  const localEducation = Math.round((price * eduPct) / 100);
  const ruralSpecial = Math.round((price * ruralPct) / 100);
  const total = acquisition + localEducation + ruralSpecial;
  return {
    ratePct,
    total,
    acquisition,
    localEducation,
    ruralSpecial,
    effectivePct: Math.round((ratePct + eduPct + ruralPct) * 100) / 100,
  };
}

/** 178 → "178만원", 12345 → "1억 2,345만원", 152.3 → "152만원". */
export function formatManwonRound(manwon: number): string {
  const v = Math.round(manwon);
  if (v < 10_000) return `${v.toLocaleString('ko-KR')}만원`;
  const eok = Math.floor(v / 10_000);
  const rest = v % 10_000;
  return rest === 0
    ? `${eok.toLocaleString('ko-KR')}억원`
    : `${eok.toLocaleString('ko-KR')}억 ${rest.toLocaleString('ko-KR')}만원`;
}
