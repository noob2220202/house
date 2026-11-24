import { AssetType, DealType } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  acquisitionTax,
  brokerageFee,
  defaultLoanPrincipal,
  formatManwonRound,
  loanPayment,
  monthlyTransactionAmount,
} from './calc';

describe('brokerageFee', () => {
  it('applies the 0.4% bracket to a 4억 4,500 apartment sale (design: 최대 178만원)', () => {
    const fee = brokerageFee({ assetType: AssetType.APT, dealType: DealType.SALE, price: 44500 });
    expect(fee).toMatchObject({ ratePct: 0.4, cap: null, fee: 178, negotiable: false });
  });

  it('caps low-priced sales and leases at the statutory limit', () => {
    expect(
      brokerageFee({ assetType: AssetType.HOUSE, dealType: DealType.SALE, price: 4900 })?.fee,
    ).toBe(25);
    expect(
      brokerageFee({ assetType: AssetType.APT, dealType: DealType.SALE, price: 19000 })?.fee,
    ).toBe(80);
    expect(
      brokerageFee({ assetType: AssetType.ONEROOM, dealType: DealType.JEONSE, price: 9500 })?.fee,
    ).toBe(30);
  });

  it('uses the lease table for 전세 and the right bracket boundaries', () => {
    expect(
      brokerageFee({ assetType: AssetType.APT, dealType: DealType.JEONSE, price: 24000 }),
    ).toMatchObject({
      ratePct: 0.3,
      fee: 72,
    });
    // exactly 9억 → the 9억 이상 bracket (0.5%)
    expect(
      brokerageFee({ assetType: AssetType.APT, dealType: DealType.SALE, price: 90000 })?.ratePct,
    ).toBe(0.5);
    expect(
      brokerageFee({ assetType: AssetType.APT, dealType: DealType.SALE, price: 150000 })?.ratePct,
    ).toBe(0.7);
  });

  it('converts 월세 to a transaction amount (×100, or ×70 under 5천만원)', () => {
    expect(monthlyTransactionAmount(2000, 65)).toBe(8500);
    expect(monthlyTransactionAmount(500, 42)).toBe(500 + 42 * 70);
    const fee = brokerageFee({
      assetType: AssetType.ONEROOM,
      dealType: DealType.MONTHLY,
      deposit: 500,
      monthlyRent: 42,
    });
    // 3,440만원 × 0.5% = 17.2만원 (under the 20만원 cap)
    expect(fee).toMatchObject({ base: 3440, ratePct: 0.5, cap: 20, fee: 17.2 });
  });

  it('treats 상가·토지 as a negotiable 0.9% ceiling and 오피스텔 with its own rates', () => {
    expect(
      brokerageFee({ assetType: AssetType.LAND, dealType: DealType.SALE, price: 18500 }),
    ).toMatchObject({
      ratePct: 0.9,
      negotiable: true,
      fee: 166.5,
    });
    expect(
      brokerageFee({ assetType: AssetType.OFFICETEL, dealType: DealType.SALE, price: 20000 })?.fee,
    ).toBe(100);
    expect(
      brokerageFee({
        assetType: AssetType.OFFICETEL,
        dealType: DealType.MONTHLY,
        deposit: 1000,
        monthlyRent: 45,
      })?.ratePct,
    ).toBe(0.4);
  });

  it('returns null without a price', () => {
    expect(
      brokerageFee({ assetType: AssetType.APT, dealType: DealType.SALE, price: null }),
    ).toBeNull();
    expect(
      brokerageFee({ assetType: AssetType.APT, dealType: DealType.SALE, price: 0 }),
    ).toBeNull();
  });
});

describe('loanPayment', () => {
  it('matches the design example: 3억 1,150 at 4.2% over 30 years ≈ 월 152만원', () => {
    expect(defaultLoanPrincipal(44500)).toBe(31150);
    const pay = loanPayment(31150, 4.2, 30);
    expect(pay?.monthly).toBeCloseTo(152.3, 1);
    expect(pay?.totalInterest).toBeGreaterThan(23000);
  });

  it('handles a zero rate and rejects bad input', () => {
    expect(loanPayment(12000, 0, 10)).toEqual({ monthly: 100, totalInterest: 0 });
    expect(loanPayment(0, 4, 30)).toBeNull();
    expect(loanPayment(10000, 4, 0)).toBeNull();
    expect(loanPayment(10000, -1, 10)).toBeNull();
  });
});

describe('acquisitionTax', () => {
  it('1주택 6억 이하: 1% + 지방교육세 0.1% (design: 약 490만원)', () => {
    const tax = acquisitionTax(44500, { exclusiveAreaSqm: 84.98 });
    expect(tax).toMatchObject({ ratePct: 1, effectivePct: 1.1, ruralSpecial: 0 });
    expect(tax?.total).toBe(445 + 45);
  });

  it('adds 농어촌특별세 above 85㎡ and slides between 6억 and 9억', () => {
    expect(acquisitionTax(48500, { exclusiveAreaSqm: 101.9 })?.effectivePct).toBe(1.3);
    expect(acquisitionTax(75000)?.ratePct).toBe(2);
    expect(acquisitionTax(120000)?.ratePct).toBe(3);
  });

  it('uses the general 4.6% for non-housing', () => {
    expect(acquisitionTax(18500, { housing: false })).toMatchObject({
      effectivePct: 4.6,
      total: 851,
    });
    expect(acquisitionTax(0)).toBeNull();
  });
});

describe('formatManwonRound', () => {
  it('formats rounded 만원 amounts', () => {
    expect(formatManwonRound(152.3)).toBe('152만원');
    expect(formatManwonRound(1780)).toBe('1,780만원');
    expect(formatManwonRound(23683)).toBe('2억 3,683만원');
    expect(formatManwonRound(20000)).toBe('2억원');
  });
});
