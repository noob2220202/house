/** All dates are shown in Korea Standard Time regardless of the viewer's (or server's) time zone. */
export const TIME_ZONE = 'Asia/Seoul';

export type DateInput = string | number | Date;

function toDate(input: DateInput): Date | null {
  // Date-only strings ("2026-11-22") are calendar dates in KST, not UTC midnights.
  const d =
    typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)
      ? new Date(`${input}T00:00:00+09:00`)
      : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  weekday: 'short',
});

const WEEKDAY: Record<string, string> = {
  Sun: '일',
  Mon: '월',
  Tue: '화',
  Wed: '수',
  Thu: '목',
  Fri: '금',
  Sat: '토',
};

interface KstParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  weekday: string;
}

/** Calendar parts of a moment in KST. */
export function kstParts(input: DateInput): KstParts | null {
  const d = toDate(input);
  if (!d) return null;
  const map: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(d)) map[p.type] = p.value;
  return {
    year: map.year ?? '',
    month: map.month ?? '',
    day: map.day ?? '',
    hour: map.hour ?? '',
    minute: map.minute ?? '',
    weekday: WEEKDAY[map.weekday ?? ''] ?? '',
  };
}

/** List style: "26.11.22" (실매물 확인일 etc.). */
export function formatDateShort(input: DateInput): string {
  const p = kstParts(input);
  return p ? `${p.year.slice(2)}.${p.month}.${p.day}` : '';
}

/** Admin / detail style: "2026.11.22". */
export function formatDate(input: DateInput): string {
  const p = kstParts(input);
  return p ? `${p.year}.${p.month}.${p.day}` : '';
}

/** "2026.11.22 14:20" */
export function formatDateTime(input: DateInput): string {
  const p = kstParts(input);
  return p ? `${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute}` : '';
}

/** "2026년 11월 22일" */
export function formatDateKorean(input: DateInput): string {
  const p = kstParts(input);
  return p ? `${p.year}년 ${Number(p.month)}월 ${Number(p.day)}일` : '';
}

/** "11.22" / with weekday "11.22 일" */
export function formatMonthDay(input: DateInput, withWeekday = false): string {
  const p = kstParts(input);
  if (!p) return '';
  return withWeekday ? `${p.month}.${p.day} ${p.weekday}` : `${p.month}.${p.day}`;
}

/** "2027.02" (입주 가능 시기, 준공 연월). */
export function formatYearMonth(input: DateInput): string {
  const p = kstParts(input);
  return p ? `${p.year}.${p.month}` : '';
}

/** ISO date (YYYY-MM-DD) of a moment in KST — for <input type="date"> and API date-only fields. */
export function toKstDateString(input: DateInput = new Date()): string {
  const p = kstParts(input);
  return p ? `${p.year}-${p.month}-${p.day}` : '';
}

/**
 * Relative time in Korean: "방금 전", "12분 전", "3시간 전", "어제", "3일 전", then "26.11.02".
 * `now` is injectable for tests and for server/client consistency.
 */
export function formatRelativeTime(input: DateInput, now: DateInput = new Date()): string {
  const d = toDate(input);
  const n = toDate(now);
  if (!d || !n) return '';
  const diffSec = Math.floor((n.getTime() - d.getTime()) / 1000);
  if (diffSec < 0) return formatDateShort(d);
  if (diffSec < 60) return '방금 전';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(
    (Date.parse(`${toKstDateString(n)}T00:00:00+09:00`) -
      Date.parse(`${toKstDateString(d)}T00:00:00+09:00`)) /
      86_400_000,
  );
  if (days <= 1) return '어제';
  if (days < 7) return `${days}일 전`;
  if (days < 28) return `${Math.floor(days / 7)}주 전`;
  return formatDateShort(d);
}

/** Days from today (KST) until the date: 3 → "D-3", 0 → "D-DAY", past → "종료". */
export function formatDday(input: DateInput, now: DateInput = new Date()): string {
  const d = toDate(input);
  const n = toDate(now);
  if (!d || !n) return '';
  const days = Math.round(
    (Date.parse(`${toKstDateString(d)}T00:00:00+09:00`) -
      Date.parse(`${toKstDateString(n)}T00:00:00+09:00`)) /
      86_400_000,
  );
  if (days < 0) return '종료';
  return days === 0 ? 'D-DAY' : `D-${days}`;
}

const timeOfDayFmt = new Intl.DateTimeFormat('ko-KR', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

/** "오후 3:42" (Asia/Seoul) — autosave stamps and the like; "" for an invalid date. */
export function formatTimeOfDay(input: DateInput): string {
  const d = toDate(input);
  return d ? timeOfDayFmt.format(d) : '';
}

/**
 * Built year of a complex / building: "2019년 준공", or "2027년 입주 예정" when the year is still
 * ahead (KST calendar year of `now`).
 */
export function formatBuiltYear(year: number, now: DateInput = new Date()): string {
  const current = Number(kstParts(now)?.year ?? new Date().getFullYear());
  return year > current ? `${year}년 입주 예정` : `${year}년 준공`;
}
