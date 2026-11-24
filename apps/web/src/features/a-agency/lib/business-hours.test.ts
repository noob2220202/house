import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BUSINESS_HOURS,
  TIME_OPTIONS,
  businessHoursSchema,
  invalidDays,
  isOpenNow,
  isValidDay,
  normalizeBusinessHours,
  summarizeBusinessHours,
} from './business-hours';

describe('summarizeBusinessHours', () => {
  it('groups consecutive days with the same hours', () => {
    expect(summarizeBusinessHours(DEFAULT_BUSINESS_HOURS)).toBe(
      '평일 09:00 – 18:00 · 토 10:00 – 15:00 · 일 휴무',
    );
  });
  it('labels every-day and weekend groups', () => {
    const all = { open: '10:00', close: '20:00' };
    expect(
      summarizeBusinessHours({
        mon: all,
        tue: all,
        wed: all,
        thu: all,
        fri: all,
        sat: all,
        sun: all,
      }),
    ).toBe('매일 10:00 – 20:00');
    const wk = { open: '09:00', close: '19:00' };
    expect(
      summarizeBusinessHours({ mon: wk, tue: wk, wed: wk, thu: wk, fri: wk, sat: null, sun: null }),
    ).toBe('평일 09:00 – 19:00 · 주말 휴무');
  });
  it('uses a range label for partial runs and splits non-adjacent days', () => {
    const a = { open: '09:00', close: '18:00' };
    expect(summarizeBusinessHours({ mon: a, tue: a, wed: null, thu: a, fri: a })).toBe(
      '월~화 09:00 – 18:00 · 수 휴무 · 목~금 09:00 – 18:00 · 주말 휴무',
    );
  });
  it('returns an empty string when nothing is set', () => {
    expect(summarizeBusinessHours(null)).toBe('');
    expect(summarizeBusinessHours({})).toBe('');
  });
});

describe('validation', () => {
  it('requires close after open', () => {
    expect(isValidDay({ open: '09:00', close: '18:00' })).toBe(true);
    expect(isValidDay({ open: '18:00', close: '09:00' })).toBe(false);
    expect(isValidDay({ open: '09:00', close: '09:00' })).toBe(false);
    expect(isValidDay(null)).toBe(true);
  });
  it('lists invalid days', () => {
    expect(
      invalidDays({
        mon: { open: '10:00', close: '09:30' },
        sat: { open: '10:00', close: '15:00' },
      }),
    ).toEqual(['mon']);
  });
  it('parses the backend JSON shape and rejects malformed times', () => {
    expect(
      businessHoursSchema.safeParse({ mon: { open: '09:00', close: '18:00' }, sun: null }).success,
    ).toBe(true);
    expect(businessHoursSchema.safeParse({ mon: { open: '9시', close: '18:00' } }).success).toBe(
      false,
    );
  });
  it('normalizes to all seven days', () => {
    expect(
      Object.keys(normalizeBusinessHours({ mon: { open: '09:00', close: '18:00' } })),
    ).toHaveLength(7);
    expect(normalizeBusinessHours(undefined).sun).toBeNull();
  });
  it('offers half-hour options from 06:00 to 23:30', () => {
    expect(TIME_OPTIONS[0]).toBe('06:00');
    expect(TIME_OPTIONS.at(-1)).toBe('23:30');
    expect(TIME_OPTIONS).toContain('18:30');
  });
});

describe('isOpenNow (Asia/Seoul)', () => {
  it('is open during business hours on a weekday', () => {
    // 2026-11-23 is a Monday. 10:30 KST = 01:30 UTC.
    expect(isOpenNow(DEFAULT_BUSINESS_HOURS, '2026-11-23T01:30:00Z')).toBe(true);
  });
  it('is closed before opening, at closing time and on closed days', () => {
    expect(isOpenNow(DEFAULT_BUSINESS_HOURS, '2026-11-22T23:30:00Z')).toBe(false); // Mon 08:30 KST
    expect(isOpenNow(DEFAULT_BUSINESS_HOURS, '2026-11-23T09:00:00Z')).toBe(false); // Mon 18:00 KST
    expect(isOpenNow(DEFAULT_BUSINESS_HOURS, '2026-11-22T03:00:00Z')).toBe(false); // Sun 12:00 KST
    expect(isOpenNow(null)).toBe(false);
  });
  it('uses the KST weekday, not the UTC one', () => {
    // Sat 23:30 UTC = Sun 08:30 KST → closed; Fri 23:30 UTC = Sat 08:30 KST → before opening.
    expect(isOpenNow(DEFAULT_BUSINESS_HOURS, '2026-11-21T02:00:00Z')).toBe(true); // Sat 11:00 KST
  });
});
