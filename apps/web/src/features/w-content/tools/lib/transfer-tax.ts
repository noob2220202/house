import { manwonToWon } from './money';

/**
 * 양도소득세 (간이) — 일반 누진세율 기준의 참고용 계산.
 * Not covered: 다주택 중과, 미등기, 비사업용 토지, 1세대1주택 장기보유특별공제 표2(거주기간), 감면.
 *
 * 분양권 (PRESALE) is never on the progressive brackets: flat 1년 미만 70%, 그 이상 60%
 * (소득세법 §104① 1호·2호·3호 단서, 2021-06-01 이후 양도) — gets no 장기보유특별공제 (토지·건물만
 * 대상, §95②) and no 1세대1주택 비과세. 양도소득 기본공제 250만원 still applies.
 */

export type TransferPropertyKind = 'HOUSING' | 'PRESALE' | 'OTHER';

/** How the rate was chosen: progressive brackets, a short-holding flat rate, or the 분양권 flat rate. */
export type TransferRateKind = 'progressive' | 'short-term' | 'presale';

export interface ProgressiveBracket {
  /** Inclusive upper bound of 과세표준 in 만원; null = no upper bound. */
  upTo: number | null;
  ratePct: number;
  /** 누진공제 (만원). */
  deduction: number;
}

export interface TransferTaxRules {
  label: string;
  brackets: readonly ProgressiveBracket[];
  /** 양도소득 기본공제 (만원, 연 1회). */
  basicDeductionManwon: number;
  /** 장기보유특별공제 (표1): 3년 이상 startPct, 이후 매년 +stepPct, 최대 maxPct. */
  longTerm: { fromYears: number; startPct: number; stepPct: number; maxPct: number };
  /**
   * Flat rates (%) by holding period: 1년 미만 / 2년 미만 / 2년 이상. `null` = progressive brackets.
   */
  flatRates: Record<
    TransferPropertyKind,
    { under1: number; under2: number | null; over2: number | null }
  >;
  /** 장기보유특별공제 applies (토지·건물 only — not 분양권). */
  longTermEligible: Record<TransferPropertyKind, boolean>;
  /** 1세대 1주택 비과세 기준 양도가액 (만원). */
  oneHomeExemptLimitManwon: number;
  localIncomeTaxRatio: number;
}

export const TRANSFER_TAX_RULES: TransferTaxRules = {
  label: '소득세법 제55조·제95조·제104조 (2023년 이후 양도분, 일반세율)',
  brackets: [
    { upTo: 1_400, ratePct: 6, deduction: 0 },
    { upTo: 5_000, ratePct: 15, deduction: 126 },
    { upTo: 8_800, ratePct: 24, deduction: 576 },
    { upTo: 15_000, ratePct: 35, deduction: 1_544 },
    { upTo: 30_000, ratePct: 38, deduction: 1_994 },
    { upTo: 50_000, ratePct: 40, deduction: 2_594 },
    { upTo: 100_000, ratePct: 42, deduction: 3_594 },
    { upTo: null, ratePct: 45, deduction: 6_594 },
  ],
  basicDeductionManwon: 250,
  longTerm: { fromYears: 3, startPct: 6, stepPct: 2, maxPct: 30 },
  flatRates: {
    HOUSING: { under1: 70, under2: 60, over2: null },
    PRESALE: { under1: 70, under2: 60, over2: 60 },
    OTHER: { under1: 50, under2: 40, over2: null },
  },
  longTermEligible: { HOUSING: true, PRESALE: false, OTHER: true },
  oneHomeExemptLimitManwon: 120_000,
  localIncomeTaxRatio: 0.1,
};

export interface TransferTaxInput {
  property: TransferPropertyKind;
  /** 양도가액 (만원). */
  salePrice: number;
  /** 취득가액 (만원). */
  purchasePrice: number;
  /** 필요경비 (만원): 중개보수, 취득세, 법무비, 자본적 지출 등. */
  expenses?: number;
  /** 보유기간 (년, 소수 가능: 1.5 = 1년 6개월). */
  holdingYears: number;
  /** 1세대 1주택 비과세 요건(2년 이상 보유 등)을 충족. */
  oneHomeExempt?: boolean;
}

export interface TransferTaxResult {
  /** 양도차익 (만원). */
  gain: number;
  /** 과세 대상 양도차익 (만원) — 고가주택은 12억 초과분 비율만. */
  taxableGain: number;
  /** 장기보유특별공제율 (%)와 금액 (만원). */
  longTermRatePct: number;
  longTermDeduction: number;
  basicDeduction: number;
  /** 과세표준 (만원). */
  taxBase: number;
  /** 적용 세율 (%): 누진세율 구간 또는 단기 단일세율. */
  ratePct: number;
  /** 단기 양도 단일세율이 적용됐는지 (주택 · 토지 2년 미만). */
  shortTerm: boolean;
  rateKind: TransferRateKind;
  /** 1세대 1주택 비과세로 전액 비과세. */
  exempt: boolean;
  /** 12억 초과 고가주택 안분 적용. */
  highValuePortion: boolean;
  incomeTaxWon: number;
  localTaxWon: number;
  totalWon: number;
}

/** 장기보유특별공제율 (표1): 3년 6% … 15년 이상 30%. */
export function longTermDeductionRatePct(
  holdingYears: number,
  rules: TransferTaxRules = TRANSFER_TAX_RULES,
): number {
  const { fromYears, startPct, stepPct, maxPct } = rules.longTerm;
  const years = Math.floor(holdingYears);
  if (years < fromYears) return 0;
  return Math.min(maxPct, startPct + (years - fromYears) * stepPct);
}

/** 누진세율 산출세액 (만원 단위 과세표준 → 원). */
export function progressiveTaxWon(
  taxBaseManwon: number,
  rules: TransferTaxRules = TRANSFER_TAX_RULES,
): { taxWon: number; ratePct: number } {
  if (taxBaseManwon <= 0) return { taxWon: 0, ratePct: rules.brackets[0]!.ratePct };
  const bracket =
    rules.brackets.find((b) => b.upTo === null || taxBaseManwon <= b.upTo) ??
    rules.brackets[rules.brackets.length - 1]!;
  const baseWon = manwonToWon(taxBaseManwon);
  const tax = Math.floor((baseWon * bracket.ratePct) / 100) - manwonToWon(bracket.deduction);
  return { taxWon: Math.max(0, tax), ratePct: bracket.ratePct };
}

export function calculateTransferTax(
  input: TransferTaxInput,
  rules: TransferTaxRules = TRANSFER_TAX_RULES,
): TransferTaxResult | null {
  const { salePrice, purchasePrice, holdingYears } = input;
  if (![salePrice, purchasePrice, holdingYears].every(Number.isFinite)) return null;
  if (salePrice <= 0 || purchasePrice < 0 || holdingYears < 0) return null;
  const expenses = input.expenses !== undefined && input.expenses > 0 ? input.expenses : 0;

  const gain = Math.max(0, salePrice - purchasePrice - expenses);
  const zero = (over: Partial<TransferTaxResult>): TransferTaxResult => ({
    gain,
    taxableGain: 0,
    longTermRatePct: 0,
    longTermDeduction: 0,
    basicDeduction: 0,
    taxBase: 0,
    ratePct: 0,
    shortTerm: false,
    rateKind: 'progressive',
    exempt: false,
    highValuePortion: false,
    incomeTaxWon: 0,
    localTaxWon: 0,
    totalWon: 0,
    ...over,
  });
  if (gain === 0) return zero({});

  const exemptEligible = input.property === 'HOUSING' && !!input.oneHomeExempt && holdingYears >= 2;
  let taxableGain = gain;
  let highValuePortion = false;
  if (exemptEligible) {
    if (salePrice <= rules.oneHomeExemptLimitManwon) return zero({ exempt: true });
    // 고가주택: 양도차익 × (양도가액 − 12억) / 양도가액
    taxableGain = (gain * (salePrice - rules.oneHomeExemptLimitManwon)) / salePrice;
    highValuePortion = true;
  }

  const flat = rules.flatRates[input.property];
  const shortRate = holdingYears < 1 ? flat.under1 : holdingYears < 2 ? flat.under2 : flat.over2;
  const rateKind: TransferRateKind =
    input.property === 'PRESALE' ? 'presale' : shortRate !== null ? 'short-term' : 'progressive';

  const longTermRatePct =
    shortRate === null && rules.longTermEligible[input.property]
      ? longTermDeductionRatePct(holdingYears, rules)
      : 0;
  const longTermDeduction = (taxableGain * longTermRatePct) / 100;
  const basicDeduction = Math.min(rules.basicDeductionManwon, taxableGain - longTermDeduction);
  const taxBase = Math.max(0, taxableGain - longTermDeduction - basicDeduction);

  let incomeTaxWon: number;
  let ratePct: number;
  if (shortRate !== null) {
    ratePct = shortRate;
    incomeTaxWon = Math.floor((manwonToWon(taxBase) * shortRate) / 100);
  } else {
    const p = progressiveTaxWon(taxBase, rules);
    ratePct = p.ratePct;
    incomeTaxWon = p.taxWon;
  }
  incomeTaxWon = Math.floor(incomeTaxWon / 10) * 10;
  const localTaxWon = Math.floor((incomeTaxWon * rules.localIncomeTaxRatio) / 10) * 10;

  return {
    gain,
    taxableGain,
    longTermRatePct,
    longTermDeduction,
    basicDeduction,
    taxBase,
    ratePct,
    shortTerm: rateKind === 'short-term',
    rateKind,
    exempt: false,
    highValuePortion,
    incomeTaxWon,
    localTaxWon,
    totalWon: incomeTaxWon + localTaxWon,
  };
}
