import { AssetType, DealType } from '@house/shared';
import { formatManwon } from '@/lib/format';
import type { ListingDetail } from '../api/schemas';
import {
  acquisitionTax,
  brokerageFee,
  defaultLoanPrincipal,
  formatManwonRound,
  loanPayment,
} from './calc';
import { headlineAmount } from './view';

/** Defaults + preview rows of "이 가격으로 계산해 보기" (shared by the server-rendered card and the sheet). */

export type CalcTab = 'loan' | 'fee' | 'tax';

export const LOAN_DEFAULTS = {
  /** 매매: LTV 70% · 연 4.2% · 30년 원리금균등. */
  purchase: { ltvPct: 70, ratePct: 4.2, years: 30 },
  /** 전세: 보증금의 80% · 연 3.9% · 만기일시(이자만). */
  lease: { ltvPct: 80, ratePct: 3.9, years: 2 },
} as const;

export interface CalcPreview {
  tab: CalcTab;
  label: string;
  value: string;
  note: string;
}

export const isPurchase = (l: Pick<ListingDetail, 'dealType'>) =>
  l.dealType === DealType.SALE || l.dealType === DealType.PRESALE;
export const isHousing = (l: Pick<ListingDetail, 'assetType'>) =>
  l.assetType !== AssetType.COMMERCIAL && l.assetType !== AssetType.LAND;

/** Interest-only monthly cost (전세대출): principal × rate / 12, in 만원. */
export const interestOnly = (principal: number, ratePct: number) =>
  Math.round(((principal * ratePct) / 100 / 12) * 10) / 10;

/** The rows of the "이 가격으로 계산해 보기" card — same maths as the sheet's defaults. */
export function calcPreviews(l: ListingDetail): CalcPreview[] {
  const amount = headlineAmount(l);
  const rows: CalcPreview[] = [];
  if (amount && l.dealType !== DealType.MONTHLY) {
    if (isPurchase(l)) {
      const d = LOAN_DEFAULTS.purchase;
      const principal = defaultLoanPrincipal(amount, d.ltvPct);
      const pay = loanPayment(principal, d.ratePct, d.years);
      if (pay) {
        rows.push({
          tab: 'loan',
          label: '대출 이자',
          value: `월 약 ${formatManwonRound(pay.monthly)}`,
          note: `${formatManwon(principal)} 대출 · 연 ${d.ratePct}% · ${d.years}년`,
        });
      }
    } else {
      const d = LOAN_DEFAULTS.lease;
      const principal = defaultLoanPrincipal(amount, d.ltvPct);
      rows.push({
        tab: 'loan',
        label: '전세대출 이자',
        value: `월 약 ${formatManwonRound(interestOnly(principal, d.ratePct))}`,
        note: `${formatManwon(principal)} 대출 · 연 ${d.ratePct}% · 이자만`,
      });
    }
  }
  const fee = brokerageFee({
    assetType: l.assetType,
    dealType: l.dealType,
    price: l.dealType === DealType.MONTHLY ? null : amount,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
  });
  if (fee) {
    rows.push({
      tab: 'fee',
      label: '중개보수',
      value: `최대 ${formatManwonRound(fee.fee)}`,
      note: `상한요율 ${fee.ratePct}%${fee.cap ? ` · 한도 ${fee.cap}만원` : ''} · 부가세 별도`,
    });
  }
  if (amount && isPurchase(l)) {
    const tax = acquisitionTax(amount, {
      exclusiveAreaSqm: l.property.exclusiveArea,
      housing: isHousing(l),
    });
    if (tax) {
      rows.push({
        tab: 'tax',
        label: '취득세',
        value: `약 ${formatManwonRound(tax.total)}`,
        note: isHousing(l)
          ? `1주택 ${tax.effectivePct}% · 지방교육세 포함`
          : `${tax.effectivePct}% · 지방교육세·농특세 포함`,
      });
    }
  }
  return rows;
}
