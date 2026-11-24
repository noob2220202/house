/** 1284 → "1,284" */
export function formatCount(n: number): string {
  return Math.trunc(n).toLocaleString('ko-KR');
}

/** View counts: 8940 → "8,940", 12000 → "1.2만", 21000 → "2.1만", 1250000 → "125만". */
export function formatCompactCount(n: number): string {
  if (n < 10000) return formatCount(n);
  const man = n / 10000;
  return `${man >= 100 ? Math.round(man).toLocaleString('ko-KR') : (Math.floor(man * 10) / 10).toString()}만`;
}

/** 0.0862 → "8.6%" */
export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** 세대수: 1412 → "1,412세대" */
export function formatHouseholds(n: number): string {
  return `${formatCount(n)}세대`;
}

/** Video length: 872 → "14:32", 3725 → "1:02:05", 45 → "0:45" (negative → "0:00"). */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const ss = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
