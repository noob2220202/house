import { BannerStatus } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  ctrOf,
  displayCode,
  scheduleHint,
  scheduleStatus,
  statusCaption,
  type Schedule,
} from './status';

// 2026-11-24 12:00 KST
const NOW = new Date('2026-11-24T03:00:00Z');
const item = (patch: Partial<Schedule> = {}): Schedule => ({
  paused: false,
  startAt: '2026-11-01T00:00:00+09:00',
  endAt: '2026-12-01T23:59:59+09:00',
  ...patch,
});

describe('scheduleStatus', () => {
  it('is computed from the paused flag and the window (same rule as the backend)', () => {
    expect(scheduleStatus(item(), NOW)).toBe(BannerStatus.ACTIVE);
    expect(scheduleStatus(item({ paused: true }), NOW)).toBe(BannerStatus.PAUSED);
    expect(
      scheduleStatus(
        item({ startAt: '2026-12-01T00:00:00+09:00', endAt: '2026-12-31T23:59:59+09:00' }),
        NOW,
      ),
    ).toBe(BannerStatus.SCHEDULED);
    expect(scheduleStatus(item({ endAt: '2026-11-19T23:59:59+09:00' }), NOW)).toBe(
      BannerStatus.ENDED,
    );
  });

  it('ended wins over paused, paused wins over scheduled', () => {
    expect(scheduleStatus(item({ paused: true, endAt: '2026-11-19T23:59:59+09:00' }), NOW)).toBe(
      BannerStatus.ENDED,
    );
    expect(
      scheduleStatus(
        item({
          paused: true,
          startAt: '2026-12-01T00:00:00+09:00',
          endAt: '2026-12-31T23:59:59+09:00',
        }),
        NOW,
      ),
    ).toBe(BannerStatus.PAUSED);
  });

  it('does not throw on unparsable dates', () => {
    expect(scheduleStatus(item({ startAt: '' }), NOW)).toBe(BannerStatus.SCHEDULED);
    expect(scheduleStatus(item({ startAt: '', paused: true }), NOW)).toBe(BannerStatus.PAUSED);
  });
});

describe('statusCaption', () => {
  it('counts the days left of a live item in KST calendar days', () => {
    expect(statusCaption(item(), NOW)).toBe('7일 남음');
    expect(statusCaption(item({ endAt: '2026-11-24T23:59:59+09:00' }), NOW)).toBe('오늘 종료');
  });

  it('shows the start of a scheduled item and the end of an ended one', () => {
    expect(
      statusCaption(
        item({ startAt: '2026-12-01T00:00:00+09:00', endAt: '2026-12-31T23:59:59+09:00' }),
        NOW,
      ),
    ).toBe('12.01 시작');
    expect(statusCaption(item({ endAt: '2026-11-19T23:59:59+09:00' }), NOW)).toBe('11.19 종료');
  });

  it('shows the memo as the pause reason', () => {
    expect(statusCaption({ ...item({ paused: true }), memo: '광고주 요청' }, NOW)).toBe(
      '광고주 요청',
    );
    expect(statusCaption({ ...item({ paused: true }), memo: '  ' }, NOW)).toBe('일시 중지');
  });
});

describe('scheduleHint', () => {
  it('says what happens automatically', () => {
    expect(
      scheduleHint(
        item({ startAt: '2026-12-01T00:00:00+09:00', endAt: '2026-12-31T23:59:59+09:00' }),
        NOW,
      ),
    ).toBe('2026.12.01 00:00 자동 노출');
    expect(scheduleHint(item(), NOW)).toBe('2026.12.01 23:59 자동 종료');
    expect(scheduleHint(item({ paused: true }), NOW)).toMatch(/노출되지 않아요/);
    expect(scheduleHint(item({ endAt: '2026-11-19T23:59:59+09:00' }), NOW)).toMatch(
      /기간이 끝났어요/,
    );
  });
});

describe('ctrOf / displayCode', () => {
  it('returns 0 without impressions', () => {
    expect(ctrOf(0, 0)).toBe(0);
    expect(ctrOf(48210, 1126)).toBeCloseTo(0.02336, 4);
  });

  it('prefers the backend code and falls back to a short id', () => {
    expect(displayCode({ id: '03b38fed-0000-4000-8000-03b38fed03b3', code: 'AD-03' })).toBe(
      'AD-03',
    );
    expect(displayCode({ id: '03b38fed-0000-4000-8000-03b38fed03b3', code: null })).toBe(
      '#03B38FED',
    );
    expect(displayCode({ id: '03b38fed-0000-4000-8000-03b38fed03b3' })).toBe('#03B38FED');
  });
});
