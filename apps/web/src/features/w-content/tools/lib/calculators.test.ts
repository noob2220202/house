import {
  ACQUISITION_TAX_RULES,
  calculateAcquisitionTax,
  housingBaseRatePct,
} from './acquisition-tax';
import { areaReferenceRows, convertArea } from './area';
import {
  BROKERAGE_FEE_SCHEDULE,
  bracketRangeLabel,
  calculateBrokerageFee,
  findBracketIndex,
  monthlyTransactionAmount,
} from './brokerage-fee';
import { calculateLoan, equalPaymentAmount, summarizeByYear } from './loan';
import {
  formatRatePct,
  formatWon,
  formatWonKorean,
  parseDecimalInput,
  parseIntegerInput,
} from './money';
import { calculateTransferTax, longTermDeductionRatePct, progressiveTaxWon } from './transfer-tax';

describe('money helpers', () => {
  it('formats 원 amounts', () => {
    expect(formatWon(1_780_000)).toBe('1,780,000원');
    expect(formatWonKorean(1_780_000)).toBe('178만원');
    expect(formatWonKorean(172_000)).toBe('17만 2,000원');
    expect(formatWonKorean(115_838_190)).toBe('1억 1,583만 8,190원');
    expect(formatWonKorean(300_000_000)).toBe('3억원');
    expect(formatWonKorean(900)).toBe('900원');
    expect(formatWonKorean(0)).toBe('0원');
    expect(formatWonKorean(-250_000)).toBe('-25만원');
  });
  it('formats rates without trailing zeros', () => {
    expect(formatRatePct(0.4)).toBe('0.4%');
    expect(formatRatePct(1.67)).toBe('1.67%');
    expect(formatRatePct(3)).toBe('3%');
    expect(formatRatePct(0.167)).toBe('0.167%');
  });
  it('parses typed numbers', () => {
    expect(parseIntegerInput('44,500')).toBe(44500);
    expect(parseIntegerInput('')).toBeNull();
    expect(parseIntegerInput('abc')).toBeNull();
    expect(parseDecimalInput('4.25')).toBe(4.25);
    expect(parseDecimalInput('1,234.5')).toBe(1234.5);
    expect(parseDecimalInput('.')).toBeNull();
    expect(parseDecimalInput('4.2.5')).toBeNull();
    expect(parseDecimalInput('')).toBeNull();
  });
});

describe('중개보수', () => {
  const housing = (deal: 'SALE' | 'JEONSE', price: number) =>
    calculateBrokerageFee({ property: 'HOUSING', deal, price });

  it('applies the 매매 brackets (mock listing L01: 4억 4,500 → 0.4%)', () => {
    const r = housing('SALE', 44_500)!;
    expect(r.maxRatePct).toBe(0.4);
    expect(r.feeWon).toBe(1_780_000);
    expect(r.capped).toBe(false);
    expect(r.bracketIndex).toBe(2);
  });

  it('uses the right 매매 rate at every boundary', () => {
    expect(housing('SALE', 4_999)!.maxRatePct).toBe(0.6);
    expect(housing('SALE', 5_000)!.maxRatePct).toBe(0.5);
    expect(housing('SALE', 19_999)!.maxRatePct).toBe(0.5);
    expect(housing('SALE', 20_000)!.maxRatePct).toBe(0.4);
    expect(housing('SALE', 89_999)!.maxRatePct).toBe(0.4);
    expect(housing('SALE', 90_000)!.maxRatePct).toBe(0.5);
    expect(housing('SALE', 120_000)!.maxRatePct).toBe(0.6);
    expect(housing('SALE', 150_000)!.maxRatePct).toBe(0.7);
    expect(housing('SALE', 90_000)!.feeWon).toBe(4_500_000);
    expect(housing('SALE', 150_000)!.feeWon).toBe(10_500_000);
  });

  it('caps the low 매매 brackets (25만 / 80만)', () => {
    expect(housing('SALE', 4_000)!.feeWon).toBe(240_000);
    const capped = housing('SALE', 4_500)!;
    expect(capped.feeWon).toBe(250_000);
    expect(capped.capped).toBe(true);
    expect(housing('SALE', 19_000)!.feeWon).toBe(800_000);
    expect(housing('SALE', 15_000)!.feeWon).toBe(750_000);
  });

  it('applies the 임대차 brackets', () => {
    expect(housing('JEONSE', 24_000)!.feeWon).toBe(720_000); // L03 전세 2억 4,000 → 0.3%
    expect(housing('JEONSE', 4_000)!.feeWon).toBe(200_000); // 0.5%, exactly the 20만 cap
    expect(housing('JEONSE', 4_800)!.feeWon).toBe(200_000); // capped
    expect(housing('JEONSE', 9_500)!.feeWon).toBe(300_000); // 0.4% = 38만 → cap 30만
    expect(housing('JEONSE', 60_000)!.maxRatePct).toBe(0.4);
    expect(housing('JEONSE', 120_000)!.maxRatePct).toBe(0.5);
    expect(housing('JEONSE', 150_000)!.maxRatePct).toBe(0.6);
  });

  it('converts 월세 with ×100, or ×70 when the result is under 5천만', () => {
    expect(monthlyTransactionAmount(2_000, 65)).toEqual({ amount: 8_500, multiplier: 100 });
    expect(monthlyTransactionAmount(500, 42)).toEqual({ amount: 3_440, multiplier: 70 });
    expect(monthlyTransactionAmount(1_000, 40)).toEqual({ amount: 5_000, multiplier: 100 });

    // L04 월세 2,000/65 → 8,500만 × 0.4% = 34만 → 한도 30만
    const l04 = calculateBrokerageFee({
      property: 'HOUSING',
      deal: 'MONTHLY',
      deposit: 2_000,
      monthlyRent: 65,
    })!;
    expect(l04.transactionAmount).toBe(8_500);
    expect(l04.feeWon).toBe(300_000);
    expect(l04.capped).toBe(true);

    // R01 월세 500/42 → 3,440만 × 0.5% = 17만 2,000원
    const r01 = calculateBrokerageFee({
      property: 'HOUSING',
      deal: 'MONTHLY',
      deposit: 500,
      monthlyRent: 42,
    })!;
    expect(r01.monthlyMultiplier).toBe(70);
    expect(r01.feeWon).toBe(172_000);
  });

  it('treats 분양권 as 납입금 + 프리미엄 on the 매매 table', () => {
    const r = calculateBrokerageFee({
      property: 'HOUSING',
      deal: 'PRESALE',
      price: 8_000,
      premium: 2_700,
    })!;
    expect(r.transactionAmount).toBe(10_700);
    expect(r.maxRatePct).toBe(0.5);
    expect(r.feeWon).toBe(535_000);
    const minus = calculateBrokerageFee({
      property: 'HOUSING',
      deal: 'PRESALE',
      price: 8_000,
      premium: -1_200,
    })!;
    expect(minus.transactionAmount).toBe(6_800);
  });

  it('handles 오피스텔 and 주택 외', () => {
    expect(
      calculateBrokerageFee({ property: 'OFFICETEL', deal: 'SALE', price: 20_000 })!.feeWon,
    ).toBe(1_000_000);
    expect(
      calculateBrokerageFee({ property: 'OFFICETEL', deal: 'JEONSE', price: 10_000 })!.feeWon,
    ).toBe(400_000);
    const land = calculateBrokerageFee({ property: 'OTHER', deal: 'SALE', price: 50_000 })!;
    expect(land.negotiable).toBe(true);
    expect(land.feeWon).toBe(4_500_000);
  });

  it('applies a negotiated rate only below the legal maximum, and VAT on request', () => {
    const lower = calculateBrokerageFee({
      property: 'HOUSING',
      deal: 'SALE',
      price: 44_500,
      negotiatedRatePct: 0.3,
    })!;
    expect(lower.appliedRatePct).toBe(0.3);
    expect(lower.feeWon).toBe(1_335_000);
    const higher = calculateBrokerageFee({
      property: 'HOUSING',
      deal: 'SALE',
      price: 44_500,
      negotiatedRatePct: 0.9,
    })!;
    expect(higher.appliedRatePct).toBe(0.4);
    const vat = calculateBrokerageFee({
      property: 'HOUSING',
      deal: 'SALE',
      price: 44_500,
      includeVat: true,
    })!;
    expect(vat.vatWon).toBe(178_000);
    expect(vat.totalWon).toBe(1_958_000);
  });

  it('returns null without a positive amount', () => {
    expect(calculateBrokerageFee({ property: 'HOUSING', deal: 'SALE' })).toBeNull();
    expect(calculateBrokerageFee({ property: 'HOUSING', deal: 'SALE', price: 0 })).toBeNull();
    expect(
      calculateBrokerageFee({ property: 'HOUSING', deal: 'MONTHLY', deposit: 0, monthlyRent: 0 }),
    ).toBeNull();
  });

  it('accepts a custom schedule (configurable table)', () => {
    const custom = {
      ...BROKERAGE_FEE_SCHEDULE,
      housing: {
        ...BROKERAGE_FEE_SCHEDULE.housing,
        sale: [{ under: null, ratePct: 0.2 }],
      },
    };
    expect(
      calculateBrokerageFee({ property: 'HOUSING', deal: 'SALE', price: 10_000 }, custom)!.feeWon,
    ).toBe(200_000);
  });

  it('labels bracket ranges for the table', () => {
    const sale = BROKERAGE_FEE_SCHEDULE.housing.sale;
    expect(bracketRangeLabel(sale, 0)).toBe('5천만원 미만');
    expect(bracketRangeLabel(sale, 1)).toBe('5천만원 이상 ~ 2억원 미만');
    expect(bracketRangeLabel(sale, 2)).toBe('2억원 이상 ~ 9억원 미만');
    expect(bracketRangeLabel(sale, 5)).toBe('15억원 이상');
    expect(findBracketIndex(sale, 999_999)).toBe(5);
  });
});

describe('취득세', () => {
  it('computes the 주택 base rate', () => {
    expect(housingBaseRatePct(44_500)).toBe(1);
    expect(housingBaseRatePct(60_000)).toBe(1);
    expect(housingBaseRatePct(70_000)).toBe(1.67);
    expect(housingBaseRatePct(75_000)).toBe(2);
    expect(housingBaseRatePct(90_000)).toBe(3);
    expect(housingBaseRatePct(100_000)).toBe(3);
  });

  it('1주택, 85㎡ 이하, 4억 4,500 → 1.1%', () => {
    const r = calculateAcquisitionTax({ property: 'HOUSING', price: 44_500 })!;
    expect(r.acquisitionTaxWon).toBe(4_450_000);
    expect(r.educationTaxWon).toBe(445_000);
    expect(r.ruralTaxWon).toBe(0);
    expect(r.totalWon).toBe(4_895_000);
    expect(r.totalRatePct).toBe(1.1);
    expect(r.surcharged).toBe(false);
  });

  it('adds 농어촌특별세 above 85㎡', () => {
    const r = calculateAcquisitionTax({ property: 'HOUSING', price: 75_000, over85: true })!;
    expect(r.acquisitionRatePct).toBe(2);
    expect(r.acquisitionTaxWon).toBe(15_000_000);
    expect(r.educationTaxWon).toBe(1_500_000);
    expect(r.ruralTaxWon).toBe(1_500_000);
    expect(r.totalRatePct).toBe(2.4);
  });

  it('uses the sliding rate between 6억 and 9억', () => {
    const r = calculateAcquisitionTax({ property: 'HOUSING', price: 70_000 })!;
    expect(r.acquisitionRatePct).toBe(1.67);
    expect(r.acquisitionTaxWon).toBe(11_690_000);
    expect(r.educationRatePct).toBe(0.167);
    expect(r.educationTaxWon).toBe(1_169_000);
  });

  it('keeps the base rate for a 2nd home and surcharges from the 3rd (비조정대상지역)', () => {
    expect(
      calculateAcquisitionTax({ property: 'HOUSING', price: 30_000, homeCount: 2 })!
        .acquisitionRatePct,
    ).toBe(1);
    const third = calculateAcquisitionTax({ property: 'HOUSING', price: 30_000, homeCount: 3 })!;
    expect(third.surcharged).toBe(true);
    expect(third.totalRatePct).toBe(8.4);
    expect(third.totalWon).toBe(25_200_000);
    const fourth = calculateAcquisitionTax({
      property: 'HOUSING',
      price: 30_000,
      homeCount: 4,
      over85: true,
    })!;
    expect(fourth.totalRatePct).toBe(13.4);
  });

  it('handles 농지 and 주택 외', () => {
    expect(calculateAcquisitionTax({ property: 'OTHER', price: 20_000 })!.totalWon).toBe(9_200_000);
    expect(calculateAcquisitionTax({ property: 'FARMLAND', price: 10_000 })!.totalRatePct).toBe(
      3.4,
    );
  });

  it('floors each tax to 10원 and rejects invalid prices', () => {
    const r = calculateAcquisitionTax({ property: 'HOUSING', price: 12_345 })!;
    expect(r.acquisitionTaxWon % 10).toBe(0);
    expect(calculateAcquisitionTax({ property: 'HOUSING', price: 0 })).toBeNull();
    expect(calculateAcquisitionTax({ property: 'HOUSING', price: Number.NaN })).toBeNull();
    expect(ACQUISITION_TAX_RULES.housing.surcharge[2]).toBeUndefined();
  });
});

describe('양도소득세 (간이)', () => {
  it('computes the progressive tax', () => {
    expect(progressiveTaxWon(1_400)).toEqual({ taxWon: 840_000, ratePct: 6 });
    expect(progressiveTaxWon(5_000)).toEqual({ taxWon: 6_240_000, ratePct: 15 });
    expect(progressiveTaxWon(8_750)).toEqual({ taxWon: 15_240_000, ratePct: 24 });
    expect(progressiveTaxWon(0).taxWon).toBe(0);
  });

  it('is continuous at every bracket boundary', () => {
    for (const edge of [1_400, 5_000, 8_800, 15_000, 30_000, 50_000, 100_000]) {
      const below = progressiveTaxWon(edge).taxWon;
      const above = progressiveTaxWon(edge + 1).taxWon;
      expect(above - below).toBeGreaterThan(0);
      expect(above - below).toBeLessThan(5_000);
    }
  });

  it('gives the 장기보유특별공제 rate', () => {
    expect(longTermDeductionRatePct(2.9)).toBe(0);
    expect(longTermDeductionRatePct(3)).toBe(6);
    expect(longTermDeductionRatePct(5.5)).toBe(10);
    expect(longTermDeductionRatePct(15)).toBe(30);
    expect(longTermDeductionRatePct(30)).toBe(30);
  });

  it('5년 보유, 양도차익 1억', () => {
    const r = calculateTransferTax({
      property: 'HOUSING',
      salePrice: 40_000,
      purchasePrice: 29_000,
      expenses: 1_000,
      holdingYears: 5,
    })!;
    expect(r.gain).toBe(10_000);
    expect(r.longTermDeduction).toBe(1_000);
    expect(r.taxBase).toBe(8_750);
    expect(r.incomeTaxWon).toBe(15_240_000);
    expect(r.localTaxWon).toBe(1_524_000);
    expect(r.totalWon).toBe(16_764_000);
  });

  it('uses the flat short-term rates', () => {
    const under1 = calculateTransferTax({
      property: 'HOUSING',
      salePrice: 30_000,
      purchasePrice: 28_000,
      holdingYears: 0.5,
    })!;
    expect(under1.shortTerm).toBe(true);
    expect(under1.ratePct).toBe(70);
    expect(under1.incomeTaxWon).toBe(12_250_000); // (2,000 − 250) × 70%
    const land = calculateTransferTax({
      property: 'OTHER',
      salePrice: 30_000,
      purchasePrice: 28_000,
      holdingYears: 1.5,
    })!;
    expect(land.ratePct).toBe(40);
  });

  it('taxes 분양권 at 60% after a year (no 장기보유특별공제, no 1주택 비과세)', () => {
    // 양도차익 2,700만 − 기본공제 250만 = 2,450만 × 60% = 14,700,000원 + 지방소득세 1,470,000원.
    const r = calculateTransferTax({
      property: 'PRESALE',
      salePrice: 12_700,
      purchasePrice: 10_000,
      holdingYears: 2,
      oneHomeExempt: true,
    })!;
    expect(r.rateKind).toBe('presale');
    expect(r.shortTerm).toBe(false);
    expect(r.exempt).toBe(false);
    expect(r.ratePct).toBe(60);
    expect(r.longTermDeduction).toBe(0);
    expect(r.taxBase).toBe(2_450);
    expect(r.incomeTaxWon).toBe(14_700_000);
    expect(r.localTaxWon).toBe(1_470_000);
    expect(r.totalWon).toBe(16_170_000);

    const long = calculateTransferTax({
      property: 'PRESALE',
      salePrice: 12_700,
      purchasePrice: 10_000,
      holdingYears: 6,
    })!;
    expect(long.ratePct).toBe(60);
    expect(long.longTermRatePct).toBe(0);
  });

  it('taxes 분양권 held under a year at 70%', () => {
    const r = calculateTransferTax({
      property: 'PRESALE',
      salePrice: 12_700,
      purchasePrice: 10_000,
      holdingYears: 0.5,
    })!;
    expect(r.ratePct).toBe(70);
    expect(r.incomeTaxWon).toBe(17_150_000); // 2,450만 × 70%
  });

  it('exempts a qualifying 1세대 1주택 up to 12억 and prorates above', () => {
    const exempt = calculateTransferTax({
      property: 'HOUSING',
      salePrice: 44_500,
      purchasePrice: 30_000,
      holdingYears: 4,
      oneHomeExempt: true,
    })!;
    expect(exempt.exempt).toBe(true);
    expect(exempt.totalWon).toBe(0);
    const high = calculateTransferTax({
      property: 'HOUSING',
      salePrice: 150_000,
      purchasePrice: 90_000,
      holdingYears: 4,
      oneHomeExempt: true,
    })!;
    expect(high.highValuePortion).toBe(true);
    expect(high.taxableGain).toBe(12_000); // 6억 × 3/15
    const notYet = calculateTransferTax({
      property: 'HOUSING',
      salePrice: 44_500,
      purchasePrice: 30_000,
      holdingYears: 1.5,
      oneHomeExempt: true,
    })!;
    expect(notYet.exempt).toBe(false);
  });

  it('returns zero tax without a gain and null for invalid input', () => {
    const loss = calculateTransferTax({
      property: 'HOUSING',
      salePrice: 20_000,
      purchasePrice: 25_000,
      holdingYears: 3,
    })!;
    expect(loss.gain).toBe(0);
    expect(loss.totalWon).toBe(0);
    expect(
      calculateTransferTax({
        property: 'HOUSING',
        salePrice: 0,
        purchasePrice: 0,
        holdingYears: 1,
      }),
    ).toBeNull();
  });
});

describe('대출 상환', () => {
  it('원리금 균등: 1억, 연 6%, 30년', () => {
    expect(Math.round(equalPaymentAmount(100_000_000, 0.005, 360))).toBe(599_551);
    const r = calculateLoan({
      principal: 100_000_000,
      annualRatePct: 6,
      months: 360,
      method: 'EQUAL_PAYMENT',
    })!;
    expect(r.schedule).toHaveLength(360);
    expect(r.firstPayment).toBe(599_551);
    expect(r.schedule[0]).toMatchObject({ interest: 500_000, principal: 99_551 });
    expect(r.schedule[359]!.balance).toBe(0);
    expect(r.schedule.reduce((s, row) => s + row.principal, 0)).toBe(100_000_000);
    expect(r.totalPayment).toBe(100_000_000 + r.totalInterest);
    expect(Math.abs(r.totalInterest - 115_838_190)).toBeLessThan(500);
  });

  it('원금 균등: 1억 2천, 연 6%, 12개월', () => {
    const r = calculateLoan({
      principal: 120_000_000,
      annualRatePct: 6,
      months: 12,
      method: 'EQUAL_PRINCIPAL',
    })!;
    expect(r.schedule[0]).toMatchObject({
      principal: 10_000_000,
      interest: 600_000,
      payment: 10_600_000,
    });
    expect(r.schedule[11]).toMatchObject({ principal: 10_000_000, interest: 50_000, balance: 0 });
    expect(r.totalInterest).toBe(3_900_000);
    expect(r.maxPayment).toBe(10_600_000);
    expect(r.lastPayment).toBe(10_050_000);
  });

  it('원금 균등 pays the rounding remainder in the last month', () => {
    const r = calculateLoan({
      principal: 100_000_000,
      annualRatePct: 4,
      months: 7,
      method: 'EQUAL_PRINCIPAL',
    })!;
    expect(r.schedule.reduce((s, row) => s + row.principal, 0)).toBe(100_000_000);
    expect(r.schedule[6]!.balance).toBe(0);
  });

  it('만기 일시: interest only, principal at the end', () => {
    const r = calculateLoan({
      principal: 100_000_000,
      annualRatePct: 5,
      months: 12,
      method: 'BULLET',
      graceMonths: 6,
    })!;
    expect(r.schedule[0]).toMatchObject({ principal: 0, interest: 416_667 });
    expect(r.schedule[11]).toMatchObject({ principal: 100_000_000, balance: 0 });
    expect(r.totalInterest).toBe(416_667 * 12);
  });

  it('supports a grace period', () => {
    const r = calculateLoan({
      principal: 100_000_000,
      annualRatePct: 6,
      months: 24,
      method: 'EQUAL_PAYMENT',
      graceMonths: 12,
    })!;
    expect(r.schedule[0]).toMatchObject({ principal: 0, interest: 500_000, balance: 100_000_000 });
    expect(r.schedule[11]!.balance).toBe(100_000_000);
    expect(r.firstPayment).toBe(Math.round(equalPaymentAmount(100_000_000, 0.005, 12)));
    expect(r.schedule[23]!.balance).toBe(0);
  });

  it('handles 0% and rejects invalid input', () => {
    const zero = calculateLoan({
      principal: 12_000_000,
      annualRatePct: 0,
      months: 12,
      method: 'EQUAL_PAYMENT',
    })!;
    expect(zero.totalInterest).toBe(0);
    expect(zero.firstPayment).toBe(1_000_000);
    expect(
      calculateLoan({ principal: 0, annualRatePct: 4, months: 12, method: 'EQUAL_PAYMENT' }),
    ).toBeNull();
    expect(
      calculateLoan({ principal: 1e8, annualRatePct: 4, months: 0, method: 'EQUAL_PAYMENT' }),
    ).toBeNull();
    expect(
      calculateLoan({ principal: 1e8, annualRatePct: 4, months: 601, method: 'EQUAL_PAYMENT' }),
    ).toBeNull();
    expect(
      calculateLoan({ principal: 1e8, annualRatePct: -1, months: 12, method: 'EQUAL_PAYMENT' }),
    ).toBeNull();
  });

  it('summarizes by year', () => {
    const r = calculateLoan({
      principal: 100_000_000,
      annualRatePct: 6,
      months: 30,
      method: 'EQUAL_PAYMENT',
    })!;
    const years = summarizeByYear(r.schedule);
    expect(years.map((y) => y.year)).toEqual([1, 2, 3]);
    expect(years.reduce((s, y) => s + y.interest, 0)).toBe(r.totalInterest);
    expect(years[2]!.balance).toBe(0);
  });
});

describe('평 ↔ ㎡', () => {
  it('converts both ways', () => {
    expect(convertArea(84.98, 'sqm')).toEqual({ sqm: 84.98, pyeong: 25.71 });
    expect(convertArea(34, 'pyeong')).toEqual({ sqm: 112.4, pyeong: 34 });
    expect(convertArea(1, 'pyeong')).toEqual({ sqm: 3.31, pyeong: 1 });
    expect(convertArea(0, 'sqm')).toEqual({ sqm: 0, pyeong: 0 });
    expect(convertArea(-1, 'sqm')).toBeNull();
    expect(convertArea(Number.NaN, 'pyeong')).toBeNull();
  });
  it('builds the reference table', () => {
    expect(areaReferenceRows([59, 84])).toEqual([
      { sqm: 59, pyeong: 17.8 },
      { sqm: 84, pyeong: 25.4 },
    ]);
  });
});
