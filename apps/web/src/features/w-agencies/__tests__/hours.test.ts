import { describe, expect, it } from 'vitest';
import type { BusinessHours } from '../api/schemas';
import {
  hasBusinessHours,
  isOpenAt,
  kstWeekdayKey,
  openStateAt,
  summarizeHours,
  toSchemaOrgHours,
  weeklyRows,
} from '../lib/hours';

const day = (open: string, close: string) => ({ open, close });
const HOURS: BusinessHours = {
  mon: day('09:00', '19:00'),
  tue: day('09:00', '19:00'),
  wed: day('09:00', '19:00'),
  thu: day('09:00', '19:00'),
  fri: day('09:00', '19:00'),
  sat: day('10:00', '15:00'),
  sun: null,
};

describe('summarizeHours', () => {
  it('groups weekdays and lists Saturday like the design', () => {
    expect(summarizeHours(HOURS)).toBe('평일 09:00 – 19:00 · 토 10:00 – 15:00');
  });
  it('can append closed days', () => {
    expect(summarizeHours(HOURS, { withClosed: true })).toBe(
      '평일 09:00 – 19:00 · 토 10:00 – 15:00 · 일 휴무',
    );
  });
  it('collapses identical days into 매일 / 주말 / ranges', () => {
    const all = Object.fromEntries(
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((k) => [k, day('10:00', '20:00')]),
    ) as BusinessHours;
    expect(summarizeHours(all)).toBe('매일 10:00 – 20:00');
    expect(
      summarizeHours({ ...HOURS, sat: day('10:00', '14:00'), sun: day('10:00', '14:00') }),
    ).toBe('평일 09:00 – 19:00 · 주말 10:00 – 14:00');
    expect(summarizeHours({ ...HOURS, fri: day('09:00', '17:00'), sat: null })).toBe(
      '월–목 09:00 – 19:00 · 금 09:00 – 17:00',
    );
  });
  it('does not merge equal days across a closed day', () => {
    expect(summarizeHours({ mon: day('09:00', '18:00'), wed: day('09:00', '18:00') })).toBe(
      '월 09:00 – 18:00 · 수 09:00 – 18:00',
    );
  });
  it('returns an empty string when nothing is registered', () => {
    expect(summarizeHours(null)).toBe('');
    expect(summarizeHours({})).toBe('');
    expect(hasBusinessHours({ sun: null })).toBe(false);
  });
});

describe('openStateAt (Asia/Seoul)', () => {
  // 2026-11-23 is a Monday.
  it('is open during business hours regardless of the runtime time zone', () => {
    expect(openStateAt(HOURS, '2026-11-23T10:30:00+09:00')).toEqual({
      open: true,
      label: '영업 중',
      hint: '19:00까지',
    });
    // 01:30 UTC = 10:30 KST
    expect(isOpenAt(HOURS, '2026-11-23T01:30:00Z')).toBe(true);
  });
  it('distinguishes before opening, after closing and closed days', () => {
    expect(openStateAt(HOURS, '2026-11-23T08:59:00+09:00')).toEqual({
      open: false,
      label: '영업 전',
      hint: '09:00 오픈',
    });
    expect(openStateAt(HOURS, '2026-11-23T19:00:00+09:00')?.label).toBe('영업 종료');
    expect(openStateAt(HOURS, '2026-11-28T14:59:00+09:00')?.open).toBe(true); // Saturday
    expect(openStateAt(HOURS, '2026-11-29T12:00:00+09:00')).toEqual({ open: false, label: '휴무' });
  });
  it('uses the Korean calendar day near midnight UTC', () => {
    // Sunday 23:30 UTC = Monday 08:30 KST → not open yet, but a Monday schedule.
    expect(openStateAt(HOURS, '2026-11-22T23:30:00Z')?.label).toBe('영업 전');
    expect(kstWeekdayKey('2026-11-22T23:30:00Z')).toBe('mon');
  });
  it('is unknown without registered hours', () => {
    expect(openStateAt(null)).toBeNull();
    expect(isOpenAt(undefined)).toBe(false);
  });
});

describe('weeklyRows / schema.org', () => {
  it('lists seven rows with 휴무 for closed days', () => {
    const rows = weeklyRows(HOURS);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toEqual({ key: 'mon', label: '월', text: '09:00 – 19:00', closed: false });
    expect(rows[6]).toEqual({ key: 'sun', label: '일', text: '휴무', closed: true });
    expect(weeklyRows(null)).toEqual([]);
  });
  it('formats openingHours for JSON-LD', () => {
    expect(toSchemaOrgHours(HOURS)).toBe('Mo-Fr 09:00-19:00, Sa 10:00-15:00');
    expect(toSchemaOrgHours(null)).toBeUndefined();
  });
});
