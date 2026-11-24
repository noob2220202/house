import { manwonToWon } from './money';

/**
 * 취득세 (basic) — 유상취득 기준. Rates are DATA (`ACQUISITION_TAX_RULES`) so they can be updated
 * when 지방세법 changes. 순천시는 조정대상지역이 아니므로 비조정대상지역 중과 기준을 쓴다.
 */

export type AcquisitionPropertyKind = 'HOUSING' | 'FARMLAND' | 'OTHER';
/** 취득 후 보유 주택 수 (세대 기준): 4 = 4주택 이상 또는 법인. */
export type HomeCount = 1 | 2 | 3 | 4;

export interface AcquisitionTaxRules {
  label: string;
  housing: {
    /** ≤ lowLimit → lowRate; > highLimit → highRate; between → (취득가액(억) × 2/3 − 3)%. */
    lowLimitManwon: number;
    highLimitManwon: number;
    lowRatePct: number;
    highRatePct: number;
    /** 지방교육세 = 취득세율 × ratio (표준세율 구간). */
    educationRatio: number;
    /** 농어촌특별세 (전용 85㎡ 초과만). */
    ruralRatePct: number;
    /** 다주택 중과 (비조정대상지역): 주택 수 → 세율. */
    surcharge: Partial<
      Record<HomeCount, { ratePct: number; educationRatePct: number; ruralRatePct: number }>
    >;
  };
  farmland: { ratePct: number; educationRatePct: number; ruralRatePct: number };
  other: { ratePct: number; educationRatePct: number; ruralRatePct: number };
}

export const ACQUISITION_TAX_RULES: AcquisitionTaxRules = {
  label: '지방세법 제11조·제13조의2 (유상취득, 비조정대상지역 기준)',
  housing: {
    lowLimitManwon: 60_000,
    highLimitManwon: 90_000,
    lowRatePct: 1,
    highRatePct: 3,
    educationRatio: 0.1,
    ruralRatePct: 0.2,
    surcharge: {
      3: { ratePct: 8, educationRatePct: 0.4, ruralRatePct: 0.6 },
      4: { ratePct: 12, educationRatePct: 0.4, ruralRatePct: 1.0 },
    },
  },
  farmland: { ratePct: 3, educationRatePct: 0.2, ruralRatePct: 0.2 },
  other: { ratePct: 4, educationRatePct: 0.4, ruralRatePct: 0.2 },
};

export interface AcquisitionTaxInput {
  property: AcquisitionPropertyKind;
  /** 취득가액 (만원). */
  price: number;
  /** 취득 후 주택 수 (HOUSING only, default 1). */
  homeCount?: HomeCount;
  /** 전용면적 85㎡ 초과 여부 (HOUSING only) — 농어촌특별세 과세 대상. */
  over85?: boolean;
}

export interface AcquisitionTaxResult {
  acquisitionRatePct: number;
  educationRatePct: number;
  ruralRatePct: number;
  totalRatePct: number;
  acquisitionTaxWon: number;
  educationTaxWon: number;
  ruralTaxWon: number;
  totalWon: number;
  /** True when a 다주택 중과세율 was applied. */
  surcharged: boolean;
}

const round = (value: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
};

/** 주택 표준세율 (%): 6억 이하 1%, 6억 초과 ~ 9억 이하 (X × 2/3 − 3)%, 9억 초과 3%. */
export function housingBaseRatePct(
  priceManwon: number,
  rules: AcquisitionTaxRules = ACQUISITION_TAX_RULES,
): number {
  const h = rules.housing;
  if (priceManwon <= h.lowLimitManwon) return h.lowRatePct;
  if (priceManwon > h.highLimitManwon) return h.highRatePct;
  // 법: 소수점 이하 다섯째 자리에서 반올림 (비율 기준) → % 기준 소수 둘째 자리.
  return round((priceManwon / 10_000) * (2 / 3) - 3, 2);
}

/** 세액: 10원 미만 절사. rate는 % (소수 셋째 자리까지). */
function taxWon(priceWon: number, ratePct: number): number {
  const raw = (priceWon * Math.round(ratePct * 1000)) / 100_000;
  return Math.floor(raw / 10) * 10;
}

export function calculateAcquisitionTax(
  input: AcquisitionTaxInput,
  rules: AcquisitionTaxRules = ACQUISITION_TAX_RULES,
): AcquisitionTaxResult | null {
  if (!Number.isFinite(input.price) || input.price <= 0) return null;
  const priceWon = manwonToWon(input.price);

  let acquisitionRatePct: number;
  let educationRatePct: number;
  let ruralRatePct: number;
  let surcharged = false;

  if (input.property === 'HOUSING') {
    const extra = rules.housing.surcharge[input.homeCount ?? 1];
    if (extra) {
      surcharged = true;
      acquisitionRatePct = extra.ratePct;
      educationRatePct = extra.educationRatePct;
      ruralRatePct = input.over85 ? extra.ruralRatePct : 0;
    } else {
      acquisitionRatePct = housingBaseRatePct(input.price, rules);
      educationRatePct = round(acquisitionRatePct * rules.housing.educationRatio, 3);
      ruralRatePct = input.over85 ? rules.housing.ruralRatePct : 0;
    }
  } else {
    const r = input.property === 'FARMLAND' ? rules.farmland : rules.other;
    acquisitionRatePct = r.ratePct;
    educationRatePct = r.educationRatePct;
    ruralRatePct = r.ruralRatePct;
  }

  const acquisitionTaxWon = taxWon(priceWon, acquisitionRatePct);
  const educationTaxWon = taxWon(priceWon, educationRatePct);
  const ruralTaxWon = taxWon(priceWon, ruralRatePct);

  return {
    acquisitionRatePct,
    educationRatePct,
    ruralRatePct,
    totalRatePct: round(acquisitionRatePct + educationRatePct + ruralRatePct, 3),
    acquisitionTaxWon,
    educationTaxWon,
    ruralTaxWon,
    totalWon: acquisitionTaxWon + educationTaxWon + ruralTaxWon,
    surcharged,
  };
}
