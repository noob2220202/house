import { kstParts, type DateInput } from '@/lib/format';
import { WEEKDAY_KEYS, type BusinessHours, type DayHours, type WeekdayKey } from '../api/schemas';

export const WEEKDAY_LABEL: Record<WeekdayKey, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

const KEY_BY_LABEL: Record<string, WeekdayKey> = {
  월: 'mon',
  화: 'tue',
  수: 'wed',
  목: 'thu',
  금: 'fri',
  토: 'sat',
  일: 'sun',
};

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** "09:00 – 19:00" */
export function formatDayHours(day: DayHours): string {
  return `${day.open} – ${day.close}`;
}

const sameHours = (a: DayHours | null | undefined, b: DayHours | null | undefined): boolean =>
  !!a && !!b && a.open === b.open && a.close === b.close;

/** True when at least one day has opening hours. */
export function hasBusinessHours(hours: BusinessHours | null | undefined): hours is BusinessHours {
  return !!hours && WEEKDAY_KEYS.some((k) => !!hours[k]);
}

export interface OpenState {
  open: boolean;
  /** "영업 중" | "영업 종료" | "휴무" | "영업 전" */
  label: string;
  /** "19:00까지" / "09:00 오픈" — today's remaining schedule, when known. */
  hint?: string;
}

/**
 * Whether the office is open at `now` (evaluated in Asia/Seoul). Returns null when the office has
 * not registered its hours — callers then hide the status instead of guessing.
 */
export function openStateAt(
  hours: BusinessHours | null | undefined,
  now: DateInput = new Date(),
): OpenState | null {
  if (!hasBusinessHours(hours)) return null;
  const p = kstParts(now);
  const key = p ? KEY_BY_LABEL[p.weekday] : undefined;
  if (!p || !key) return null;
  const today = hours[key];
  if (!today) return { open: false, label: '휴무' };
  const minutes = Number(p.hour) * 60 + Number(p.minute);
  const open = toMinutes(today.open);
  const close = toMinutes(today.close);
  if (minutes < open) return { open: false, label: '영업 전', hint: `${today.open} 오픈` };
  if (minutes >= close) return { open: false, label: '영업 종료' };
  return { open: true, label: '영업 중', hint: `${today.close}까지` };
}

export function isOpenAt(hours: BusinessHours | null | undefined, now: DateInput = new Date()) {
  return openStateAt(hours, now)?.open === true;
}

interface HoursGroup {
  from: WeekdayKey;
  to: WeekdayKey;
  hours: DayHours;
}

/** Consecutive days with identical hours, in week order (closed days are skipped). */
function groupHours(hours: BusinessHours): HoursGroup[] {
  const groups: HoursGroup[] = [];
  let prevIndex = -2;
  WEEKDAY_KEYS.forEach((key, index) => {
    const day = hours[key];
    if (!day) return;
    const last = groups[groups.length - 1];
    if (last && prevIndex === index - 1 && sameHours(last.hours, day)) last.to = key;
    else groups.push({ from: key, to: key, hours: day });
    prevIndex = index;
  });
  return groups;
}

function groupLabel(g: HoursGroup): string {
  if (g.from === 'mon' && g.to === 'sun') return '매일';
  if (g.from === 'mon' && g.to === 'fri') return '평일';
  if (g.from === 'sat' && g.to === 'sun') return '주말';
  if (g.from === g.to) return WEEKDAY_LABEL[g.from];
  return `${WEEKDAY_LABEL[g.from]}–${WEEKDAY_LABEL[g.to]}`;
}

/**
 * One-line summary: "평일 09:00 – 19:00 · 토 10:00 – 15:00". Closed days are left out; pass
 * `withClosed` to append them ("· 일 휴무"). Returns "" when no hours are registered.
 */
export function summarizeHours(
  hours: BusinessHours | null | undefined,
  options: { withClosed?: boolean } = {},
): string {
  if (!hasBusinessHours(hours)) return '';
  const parts = groupHours(hours).map((g) => `${groupLabel(g)} ${formatDayHours(g.hours)}`);
  if (options.withClosed) {
    const closed = WEEKDAY_KEYS.filter((k) => !hours[k]).map((k) => WEEKDAY_LABEL[k]);
    if (closed.length > 0) parts.push(`${closed.join('·')} 휴무`);
  }
  return parts.join(' · ');
}

export interface WeeklyRow {
  key: WeekdayKey;
  label: string;
  text: string;
  closed: boolean;
}

/** Seven rows (월→일) for the weekly table on the agency page. */
export function weeklyRows(hours: BusinessHours | null | undefined): WeeklyRow[] {
  if (!hasBusinessHours(hours)) return [];
  return WEEKDAY_KEYS.map((key) => {
    const day = hours[key];
    return {
      key,
      label: WEEKDAY_LABEL[key],
      text: day ? formatDayHours(day) : '휴무',
      closed: !day,
    };
  });
}

/** Weekday key of a moment in KST (for highlighting today's row). */
export function kstWeekdayKey(now: DateInput = new Date()): WeekdayKey | null {
  const p = kstParts(now);
  return (p && KEY_BY_LABEL[p.weekday]) ?? null;
}

/** schema.org `openingHours` value: "Mo-Fr 09:00-19:00, Sa 10:00-15:00". */
export function toSchemaOrgHours(hours: BusinessHours | null | undefined): string | undefined {
  if (!hasBusinessHours(hours)) return undefined;
  const code: Record<WeekdayKey, string> = {
    mon: 'Mo',
    tue: 'Tu',
    wed: 'We',
    thu: 'Th',
    fri: 'Fr',
    sat: 'Sa',
    sun: 'Su',
  };
  return groupHours(hours)
    .map(
      (g) =>
        `${g.from === g.to ? code[g.from] : `${code[g.from]}-${code[g.to]}`} ${g.hours.open}-${g.hours.close}`,
    )
    .join(', ');
}
