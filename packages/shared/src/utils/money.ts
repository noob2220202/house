/**
 * Prices are stored as integer 만원 (10,000 KRW).
 * formatManwon(125000) → "12억 5,000", formatManwon(9500) → "9,500", formatManwon(30000) → "3억".
 */
export function formatManwon(manwon: number): string {
  if (!Number.isFinite(manwon)) return '';
  const sign = manwon < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(manwon));
  const eok = Math.floor(abs / 10000);
  const rest = abs % 10000;
  if (eok === 0) return `${sign}${rest.toLocaleString('ko-KR')}`;
  if (rest === 0) return `${sign}${eok.toLocaleString('ko-KR')}억`;
  return `${sign}${eok.toLocaleString('ko-KR')}억 ${rest.toLocaleString('ko-KR')}`;
}

/** 월세 display: "1,000/50" (보증금/월세, 만원). */
export function formatMonthlyRent(deposit: number, monthlyRent: number): string {
  return `${formatManwon(deposit)}/${monthlyRent.toLocaleString('ko-KR')}`;
}

export function wonToManwon(won: number): number {
  return Math.round(won / 10000);
}
