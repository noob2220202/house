/** Money helpers for the calculators. Inputs are integer 만원 (site convention); results are 원. */

export const WON_PER_MANWON = 10_000;

export function manwonToWon(manwon: number): number {
  return Math.round(manwon * WON_PER_MANWON);
}

/** 1780000 → "1,780,000원" */
export function formatWon(won: number): string {
  return `${Math.round(won).toLocaleString('ko-KR')}원`;
}

/**
 * Korean reading of a 원 amount: 1780000 → "178만원", 172000 → "17만 2,000원",
 * 115838190 → "1억 1,583만 8,190원", 900 → "900원", 0 → "0원".
 */
export function formatWonKorean(won: number): string {
  if (!Number.isFinite(won)) return '';
  const sign = won < 0 ? '-' : '';
  const abs = Math.abs(Math.round(won));
  const eok = Math.floor(abs / 100_000_000);
  const man = Math.floor((abs % 100_000_000) / WON_PER_MANWON);
  const rest = abs % WON_PER_MANWON;
  const parts: string[] = [];
  if (eok > 0) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man > 0) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (rest > 0 || parts.length === 0) parts.push(rest.toLocaleString('ko-KR'));
  return `${sign}${parts.join(' ')}원`;
}

/** Rate for display without trailing zeros: 0.4 → "0.4%", 1.67 → "1.67%", 3 → "3%". */
export function formatRatePct(ratePct: number, maxDigits = 3): string {
  return `${Number(ratePct.toFixed(maxDigits)).toString()}%`;
}

/** Digits typed into a money/number field → non-negative integer (or null when empty). */
export function parseIntegerInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits === '') return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** Decimal field ("4.25", "84,98" is NOT accepted as decimal comma) → number or null. */
export function parseDecimalInput(raw: string): number | null {
  const cleaned = raw.replace(/[,\s]/g, '');
  if (cleaned === '' || !/^\d*\.?\d*$/.test(cleaned) || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
