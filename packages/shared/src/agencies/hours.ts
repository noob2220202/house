// Owned by the agencies module team. 영업시간 (business hours) helpers, evaluated in Asia/Seoul.

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: '월',
  tue: '화',
  wed: '수',
  thu: '목',
  fri: '금',
  sat: '토',
  sun: '일',
};

/** "HH:MM", 00:00–24:00. */
export const TIME_OF_DAY_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export interface DayHours {
  open: string;
  close: string;
}

/** A missing or null day means 휴무. */
export type BusinessHours = Partial<Record<Weekday, DayHours | null>> & { note?: string };

export function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** JS getUTCDay() (0 = Sunday) → Weekday. */
const BY_UTC_DAY: readonly Weekday[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** Whether the office is open at `now` (KST). Unknown hours → null. */
export function isOpenAt(hours: BusinessHours | null | undefined, now: Date): boolean | null {
  if (!hours) return null;
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const day = BY_UTC_DAY[kst.getUTCDay()] as Weekday;
  const today = hours[day];
  if (!today) return false;
  const minute = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return minute >= minutesOfDay(today.open) && minute < minutesOfDay(today.close);
}
