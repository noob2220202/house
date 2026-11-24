import { z } from 'zod';
import { kstParts, type DateInput } from '@/lib/format';

/**
 * Agency business hours. Mirrors the `business_hours` JSON column of the Agency model:
 * `{ mon: { open: "09:00", close: "18:00" }, … }` — a closed day is `null` (or missing).
 */
export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABEL: Record<DayKey, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const dayHoursSchema = z.object({
  open: z.string().regex(HHMM, '시간 형식은 09:00 입니다.'),
  close: z.string().regex(HHMM, '시간 형식은 18:00 입니다.'),
});
export type DayHours = z.infer<typeof dayHoursSchema>;

export const businessHoursSchema = z.object({
  mon: dayHoursSchema.nullish(),
  tue: dayHoursSchema.nullish(),
  wed: dayHoursSchema.nullish(),
  thu: dayHoursSchema.nullish(),
  fri: dayHoursSchema.nullish(),
  sat: dayHoursSchema.nullish(),
  sun: dayHoursSchema.nullish(),
});
export type BusinessHours = z.infer<typeof businessHoursSchema>;

/** Typical local office hours: 평일 09:00–18:00 · 토 10:00–15:00 · 일 휴무. */
export const DEFAULT_BUSINESS_HOURS: Record<DayKey, DayHours | null> = {
  mon: { open: '09:00', close: '18:00' },
  tue: { open: '09:00', close: '18:00' },
  wed: { open: '09:00', close: '18:00' },
  thu: { open: '09:00', close: '18:00' },
  fri: { open: '09:00', close: '18:00' },
  sat: { open: '10:00', close: '15:00' },
  sun: null,
};

/** Fills every day key (missing → closed) so forms always have 7 rows. */
export function normalizeBusinessHours(
  hours: BusinessHours | null | undefined,
): Record<DayKey, DayHours | null> {
  const out = {} as Record<DayKey, DayHours | null>;
  for (const day of DAY_KEYS) out[day] = hours?.[day] ?? null;
  return out;
}

export function toMinutes(hhmm: string): number {
  const [h = '0', m = '0'] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}

/** A day is valid when it is closed or closes after it opens. */
export function isValidDay(day: DayHours | null | undefined): boolean {
  if (!day) return true;
  return HHMM.test(day.open) && HHMM.test(day.close) && toMinutes(day.close) > toMinutes(day.open);
}

/** Day keys whose hours are invalid (close ≤ open or malformed). */
export function invalidDays(hours: BusinessHours | null | undefined): DayKey[] {
  return DAY_KEYS.filter((d) => !isValidDay(hours?.[d]));
}

function sameHours(a: DayHours | null, b: DayHours | null): boolean {
  if (!a || !b) return a === b;
  return a.open === b.open && a.close === b.close;
}

function rangeLabel(days: readonly DayKey[]): string {
  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) return '';
  if (days.length === 1) return DAY_LABEL[first];
  if (days.length === 5 && first === 'mon' && last === 'fri') return '평일';
  if (days.length === 7) return '매일';
  if (days.length === 2 && first === 'sat' && last === 'sun') return '주말';
  return `${DAY_LABEL[first]}~${DAY_LABEL[last]}`;
}

/**
 * One-line summary grouping consecutive days with the same hours:
 * "평일 09:00 – 19:00 · 토 10:00 – 15:00 · 일 휴무". Returns '' when nothing is set.
 */
export function summarizeBusinessHours(hours: BusinessHours | null | undefined): string {
  if (!hours) return '';
  const norm = normalizeBusinessHours(hours);
  if (DAY_KEYS.every((d) => norm[d] === null)) return '';
  const groups: { days: DayKey[]; hours: DayHours | null }[] = [];
  for (const day of DAY_KEYS) {
    const last = groups[groups.length - 1];
    if (last && sameHours(last.hours, norm[day])) last.days.push(day);
    else groups.push({ days: [day], hours: norm[day] });
  }
  return groups
    .map((g) =>
      g.hours
        ? `${rangeLabel(g.days)} ${g.hours.open} – ${g.hours.close}`
        : `${rangeLabel(g.days)} 휴무`,
    )
    .join(' · ');
}

const WEEKDAY_TO_KEY: Record<string, DayKey> = {
  일: 'sun',
  월: 'mon',
  화: 'tue',
  수: 'wed',
  목: 'thu',
  금: 'fri',
  토: 'sat',
};

/** True when the office is open at `now` (Asia/Seoul). */
export function isOpenNow(
  hours: BusinessHours | null | undefined,
  now: DateInput = new Date(),
): boolean {
  if (!hours) return false;
  const parts = kstParts(now);
  if (!parts) return false;
  const key = WEEKDAY_TO_KEY[parts.weekday];
  const day = key ? hours[key] : null;
  if (!day) return false;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  return minutes >= toMinutes(day.open) && minutes < toMinutes(day.close);
}

/** Half-hour options for the open/close selects: 06:00 … 23:30. */
export const TIME_OPTIONS: readonly string[] = Array.from({ length: 36 }, (_, i) => {
  const total = 6 * 60 + i * 30;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
});

/** Same opening hours on every day (missing day = closed). */
export function sameBusinessHours(
  a: BusinessHours | null | undefined,
  b: BusinessHours | null | undefined,
): boolean {
  const x = normalizeBusinessHours(a);
  const y = normalizeBusinessHours(b);
  return DAY_KEYS.every((d) => {
    const p = x[d];
    const q = y[d];
    if (!p || !q) return p === q;
    return p.open === q.open && p.close === q.close;
  });
}
