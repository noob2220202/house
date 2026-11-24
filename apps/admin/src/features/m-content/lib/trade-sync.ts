const KST = 9 * 3600_000;

/** YYYYMM of the month `monthsBack` before `now` in KST (default 1 = previous month). */
export function previousYearMonth(now: Date, monthsBack = 1): number {
  const kst = new Date(now.getTime() + KST);
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - monthsBack, 1));
  return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1;
}

/** "12.01 04:00" — the next monthly run (1st of the month, 04:00 KST) after `now`. */
export function nextScheduledRun(now: Date): string {
  const kst = new Date(now.getTime() + KST);
  let year = kst.getUTCFullYear();
  let month = kst.getUTCMonth();
  const thisMonthRun = Date.UTC(year, month, 1, 4, 0, 0);
  if (kst.getTime() >= thisMonthRun) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return `${String(month + 1).padStart(2, '0')}.01 04:00`;
}

/** "38초" · "2분 5초" between two ISO timestamps; "–" while the run has not finished. */
export function durationLabel(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return '–';
  const seconds = Math.max(
    0,
    Math.round((new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000),
  );
  if (!Number.isFinite(seconds)) return '–';
  if (seconds < 60) return `${seconds}초`;
  const rest = seconds % 60;
  return rest === 0 ? `${Math.floor(seconds / 60)}분` : `${Math.floor(seconds / 60)}분 ${rest}초`;
}
