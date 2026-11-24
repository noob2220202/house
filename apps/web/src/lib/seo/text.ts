import { formatManwon } from '@house/shared';

/** 202610 → "2026년 10월" */
export function ymLabel(ym: number): string {
  return `${Math.floor(ym / 100)}년 ${ym % 100}월`;
}

/** 202610 → "2026.10" */
export function ymDot(ym: number): string {
  return `${Math.floor(ym / 100)}.${String(ym % 100).padStart(2, '0')}`;
}

/** Amount in prose: 39198 → "3억 9,198만 원", 30000 → "3억 원", 9500 → "9,500만 원". */
export function manwonText(manwon: number): string {
  const n = Math.round(manwon);
  if (n !== 0 && n % 10000 === 0) return `${formatManwon(n)} 원`;
  return `${formatManwon(n)}만 원`;
}

/** "2026-11-17" → "2026년 11월 17일" (date-only strings, no time zone shift). */
export function dateOnlyLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  return m ? `${m[1]}년 ${Number(m[2])}월 ${Number(m[3])}일` : date;
}

/** Signed percentage change: (41, 27) → "+51.9%"; null when there is no base. */
export function percentChange(current: number | null, base: number | null): string | null {
  if (current === null || base === null || base === 0) return null;
  const p = ((current - base) / base) * 100;
  const rounded = Math.round(p * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}%`;
}
