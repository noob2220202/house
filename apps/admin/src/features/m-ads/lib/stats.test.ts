import { describe, expect, it } from 'vitest';
import { dailyRows, lastLabelCollides, resolveRange, summarize, totalsRange } from './stats';

// 2026-11-24 12:00 KST
const NOW = new Date('2026-11-24T03:00:00Z');

describe('resolveRange', () => {
  it('defaults to the last 14 days including today (KST)', () => {
    expect(resolveRange({}, NOW)).toEqual({ preset: '14', from: '2026-11-11', to: '2026-11-24' });
  });

  it('reads the presets', () => {
    expect(resolveRange({ range: '7' }, NOW)).toEqual({
      preset: '7',
      from: '2026-11-18',
      to: '2026-11-24',
    });
    expect(resolveRange({ range: '30' }, NOW)).toMatchObject({
      from: '2026-10-26',
      to: '2026-11-24',
    });
    expect(resolveRange({ range: 'all' }, NOW)).toEqual({ preset: 'all' });
    expect(resolveRange({ range: 'bogus' }, NOW).preset).toBe('14');
  });

  it('a valid custom range wins over the preset', () => {
    expect(resolveRange({ range: '7', from: '2026-11-01', to: '2026-11-10' }, NOW)).toEqual({
      preset: 'custom',
      from: '2026-11-01',
      to: '2026-11-10',
    });
  });

  it('ignores a broken custom range', () => {
    expect(resolveRange({ from: '2026-11-10', to: '2026-11-01' }, NOW).preset).toBe('14');
    expect(resolveRange({ from: 'x', to: '2026-11-01' }, NOW).preset).toBe('14');
    expect(resolveRange({ from: '2026-11-01' }, NOW).preset).toBe('14');
  });
});

describe('dailyRows', () => {
  const stats = {
    daily: [
      { date: '2026-11-03', impressions: 300, clicks: 9 },
      { date: '2026-11-01', impressions: 100, clicks: 2 },
    ],
  };

  it('sorts by day and fills the days without a stat row with zeros', () => {
    expect(dailyRows(stats)).toEqual([
      { date: '2026-11-01', impressions: 100, clicks: 2, ctr: 0.02 },
      { date: '2026-11-02', impressions: 0, clicks: 0, ctr: 0 },
      { date: '2026-11-03', impressions: 300, clicks: 9, ctr: 0.03 },
    ]);
  });

  it('covers the whole requested range', () => {
    const rows = dailyRows(stats, { from: '2026-10-31', to: '2026-11-04' });
    expect(rows.map((r) => r.date)).toEqual([
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
    expect(rows[0]?.impressions).toBe(0);
  });

  it('returns nothing without data or with a broken range', () => {
    expect(dailyRows({ daily: [] })).toEqual([]);
    expect(dailyRows(stats, { from: '2026-11-05', to: '2026-11-01' })).toEqual([]);
  });

  it('caps very long ranges', () => {
    expect(dailyRows(stats, { from: '2020-01-01', to: '2026-11-24' })).toHaveLength(400);
  });
});

describe('summarize', () => {
  it('adds up the rows and finds the best day', () => {
    const rows = dailyRows({
      daily: [
        { date: '2026-11-01', impressions: 100, clicks: 2 },
        { date: '2026-11-02', impressions: 300, clicks: 10 },
      ],
    });
    expect(summarize(rows)).toEqual({
      impressions: 400,
      clicks: 12,
      ctr: 0.03,
      activeDays: 2,
      avgImpressions: 200,
      avgClicks: 6,
      best: rows[1],
    });
  });

  it('averages from the first day with impressions, not from the start of the range', () => {
    const rows = dailyRows(
      {
        daily: [
          { date: '2026-11-03', impressions: 300, clicks: 9 },
          { date: '2026-11-04', impressions: 0, clicks: 0 }, // paused for a day: still counts
          { date: '2026-11-05', impressions: 300, clicks: 9 },
        ],
      },
      { from: '2026-10-27', to: '2026-11-05' },
    );
    expect(rows).toHaveLength(10);
    expect(summarize(rows)).toMatchObject({ activeDays: 3, avgImpressions: 200, avgClicks: 6 });
  });

  it('is all zeros for an empty range', () => {
    expect(summarize([])).toEqual({
      impressions: 0,
      clicks: 0,
      ctr: 0,
      activeDays: 0,
      avgImpressions: 0,
      avgClicks: 0,
      best: null,
    });
  });
});

describe('lastLabelCollides', () => {
  it('is false when the last point is on the label grid', () => {
    // 1100px → 15 labels max → every label of a 14-day series is shown
    expect(lastLabelCollides(14, 1100)).toBe(false);
    // 7 points on a phone: every 2nd label, last index 6 is on the grid
    expect(lastLabelCollides(7, 320)).toBe(false);
  });

  it('is true when the forced last label lands right next to a grid label', () => {
    // 14 points at 320px: every 4th label (0, 4, 8, 12) + the last (13) → 12 and 13 touch
    expect(lastLabelCollides(14, 320)).toBe(true);
  });

  it('decides by the pixel distance between the last two labels', () => {
    // 30 points at 1100px: every 2nd label, last is 29 → 28 and 29 are ~36px apart → too close
    expect(lastLabelCollides(30, 1100)).toBe(true);
    // 24 points at 320px: every 6th (0, 6, 12, 18) + 23 → five steps ≈ 57px apart → room enough
    expect(lastLabelCollides(24, 320)).toBe(false);
  });

  it('ignores tiny series and an unmeasured chart', () => {
    expect(lastLabelCollides(2, 320)).toBe(false);
    expect(lastLabelCollides(14, 0)).toBe(false);
  });
});

describe('totalsRange', () => {
  // 2026-11-24 12:00 KST
  const now = new Date('2026-11-24T03:00:00Z');
  it('covers the whole campaign up to today (the API defaults to 30 days otherwise)', () => {
    expect(
      totalsRange(
        { startAt: '2026-09-01T00:00:00+09:00', endAt: '2026-12-31T23:59:59+09:00' },
        now,
      ),
    ).toEqual({ from: '2026-09-01', to: '2026-11-24' });
  });
  it('stops at the end day of an ended banner', () => {
    expect(
      totalsRange(
        { startAt: '2026-10-01T00:00:00+09:00', endAt: '2026-10-31T23:59:59+09:00' },
        now,
      ),
    ).toEqual({ from: '2026-10-01', to: '2026-10-31' });
  });
  it('keeps the most recent 366 days and returns null before the start', () => {
    expect(
      totalsRange(
        { startAt: '2024-01-01T00:00:00+09:00', endAt: '2027-01-01T00:00:00+09:00' },
        now,
      ),
    ).toEqual({ from: '2025-11-24', to: '2026-11-24' });
    expect(
      totalsRange(
        { startAt: '2026-12-01T00:00:00+09:00', endAt: '2026-12-31T23:59:59+09:00' },
        now,
      ),
    ).toBeNull();
  });
});
