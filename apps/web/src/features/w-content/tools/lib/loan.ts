/** 대출 상환 계산: 원리금 균등 · 원금 균등 · 만기 일시. Amounts in 원, rounded to 1원 per month. */

export type RepaymentMethod = 'EQUAL_PAYMENT' | 'EQUAL_PRINCIPAL' | 'BULLET';

export const REPAYMENT_METHOD_LABEL: Record<RepaymentMethod, string> = {
  EQUAL_PAYMENT: '원리금 균등',
  EQUAL_PRINCIPAL: '원금 균등',
  BULLET: '만기 일시',
};

export interface LoanInput {
  /** 대출 원금 (원). */
  principal: number;
  /** 연 이자율 (%). */
  annualRatePct: number;
  /** 대출 기간 (개월). */
  months: number;
  method: RepaymentMethod;
  /** 거치 기간 (개월): 이자만 내는 기간. 대출 기간에 포함된다. */
  graceMonths?: number;
}

export interface LoanScheduleRow {
  /** 회차 (1-based). */
  month: number;
  /** 납입 원금. */
  principal: number;
  /** 납입 이자. */
  interest: number;
  /** 월 상환액 = 원금 + 이자. */
  payment: number;
  /** 납입 후 잔액. */
  balance: number;
}

export interface LoanResult {
  schedule: LoanScheduleRow[];
  totalInterest: number;
  totalPayment: number;
  /** 첫 회차 상환액 (거치 기간이 있으면 거치 이후 첫 회차). */
  firstPayment: number;
  lastPayment: number;
  /** 가장 큰 월 상환액. */
  maxPayment: number;
  /** 월 평균 상환액. */
  averagePayment: number;
}

export const LOAN_LIMITS = { maxMonths: 600, maxRatePct: 30 } as const;

/** 원리금 균등 월 상환액 (반올림 전). */
export function equalPaymentAmount(principal: number, monthlyRate: number, months: number): number {
  if (months <= 0) return 0;
  if (monthlyRate === 0) return principal / months;
  const pow = (1 + monthlyRate) ** months;
  return (principal * monthlyRate * pow) / (pow - 1);
}

export function calculateLoan(input: LoanInput): LoanResult | null {
  const { principal, annualRatePct, method } = input;
  const months = Math.floor(input.months);
  if (![principal, annualRatePct, months].every(Number.isFinite)) return null;
  if (principal <= 0 || months <= 0 || annualRatePct < 0) return null;
  if (months > LOAN_LIMITS.maxMonths || annualRatePct > LOAN_LIMITS.maxRatePct) return null;

  const r = annualRatePct / 100 / 12;
  const grace =
    method === 'BULLET' ? 0 : Math.min(Math.max(0, Math.floor(input.graceMonths ?? 0)), months - 1);
  const amortMonths = months - grace;

  const schedule: LoanScheduleRow[] = [];
  let balance = Math.round(principal);
  const fixedPayment =
    method === 'EQUAL_PAYMENT' ? Math.round(equalPaymentAmount(balance, r, amortMonths)) : 0;
  const fixedPrincipal = method === 'EQUAL_PRINCIPAL' ? Math.floor(balance / amortMonths) : 0;

  for (let month = 1; month <= months; month += 1) {
    const interest = Math.round(balance * r);
    const isLast = month === months;
    let paidPrincipal: number;
    if (month <= grace) paidPrincipal = 0;
    else if (isLast) paidPrincipal = balance;
    else if (method === 'EQUAL_PAYMENT')
      paidPrincipal = Math.min(balance, Math.max(0, fixedPayment - interest));
    else if (method === 'EQUAL_PRINCIPAL') paidPrincipal = Math.min(balance, fixedPrincipal);
    else paidPrincipal = 0;
    balance -= paidPrincipal;
    schedule.push({
      month,
      principal: paidPrincipal,
      interest,
      payment: paidPrincipal + interest,
      balance,
    });
  }

  const totalInterest = schedule.reduce((sum, row) => sum + row.interest, 0);
  const totalPayment = schedule.reduce((sum, row) => sum + row.payment, 0);
  const firstAmort = schedule[grace] ?? schedule[0]!;
  return {
    schedule,
    totalInterest,
    totalPayment,
    firstPayment: firstAmort.payment,
    lastPayment: schedule[schedule.length - 1]!.payment,
    maxPayment: schedule.reduce((max, row) => Math.max(max, row.payment), 0),
    averagePayment: Math.round(totalPayment / months),
  };
}

export interface LoanYearSummary {
  year: number;
  principal: number;
  interest: number;
  payment: number;
  balance: number;
}

/** Collapses the monthly schedule into yearly rows (for long loans). */
export function summarizeByYear(schedule: readonly LoanScheduleRow[]): LoanYearSummary[] {
  const out: LoanYearSummary[] = [];
  for (const row of schedule) {
    const year = Math.ceil(row.month / 12);
    const last = out[out.length - 1];
    if (last && last.year === year) {
      last.principal += row.principal;
      last.interest += row.interest;
      last.payment += row.payment;
      last.balance = row.balance;
    } else {
      out.push({
        year,
        principal: row.principal,
        interest: row.interest,
        payment: row.payment,
        balance: row.balance,
      });
    }
  }
  return out;
}
