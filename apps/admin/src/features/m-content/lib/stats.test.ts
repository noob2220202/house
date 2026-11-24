import { describe, expect, it } from 'vitest';
import {
  axisLabelIndexes,
  bucketDays,
  chartData,
  deltaOf,
  formatMinutes,
  pctChange,
  peakIndex,
  ratio,
  shortDate,
  sparseLabels,
  sum,
  toCsv,
  total,
  weekdayLabel,
  weekdayOf,
} from './stats';

const days = (count: number, start = '2026-11-01') =>
  Array.from({ length: count }, (_, i) => {
    const date = new Date(new Date(`${start}T00:00:00Z`).getTime() + i * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { date, n: i + 1 };
  });

describe('stats math', () => {
  it('sums, ratios and percentage changes', () => {
    expect(sum([1, 2, 3])).toBe(6);
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(1, 0)).toBe(0);
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(5, 0)).toBeNull();
    expect(total([{ v: 2 }, { v: 3 }], (r) => r.v)).toBe(5);
  });

  it('builds delta chips', () => {
    expect(deltaOf(1086, 1000)).toEqual({ direction: 'up', label: '8.6%' });
    expect(deltaOf(900, 1000)).toEqual({ direction: 'down', label: '10.0%' });
    expect(deltaOf(1000, 1000.2)).toEqual({ direction: 'flat', label: '0.0%' });
    expect(deltaOf(10, 0)).toBeNull();
  });

  it('finds the peak', () => {
    expect(peakIndex([3, 9, 9, 1])).toBe(1);
    expect(peakIndex([])).toBe(-1);
  });

  it('formats minutes', () => {
    expect(formatMinutes(42)).toBe('42분');
    expect(formatMinutes(65)).toBe('1시간 5분');
    expect(formatMinutes(120)).toBe('2시간');
    expect(formatMinutes(-3)).toBe('0분');
  });
});

describe('time buckets', () => {
  it('aligns 7-day buckets to the newest day', () => {
    const buckets = bucketDays(days(16), 7);
    expect(buckets.map((b) => b.rows.length)).toEqual([2, 7, 7]);
    expect(buckets[2]).toMatchObject({ from: '2026-11-10', to: '2026-11-16' });
    expect(bucketDays(days(3), 1)).toHaveLength(3);
  });

  it('keeps days up to 31 points and switches to weeks beyond', () => {
    const daily = chartData(days(30), (rows) => rows.reduce((a, r) => a + r.n, 0));
    expect(daily.weekly).toBe(false);
    expect(daily.values).toHaveLength(30);
    expect(daily.days).toBe(30);
    expect(daily.labels[0]).toBe('11.01');
    expect(daily.titles[0]).toBe('11.01 (일)');

    const weekly = chartData(days(90, '2026-08-27'), (rows) => rows.length);
    expect(weekly.weekly).toBe(true);
    // 90 = 12 full weeks + 6 days: the partial oldest week is not charted.
    expect(weekly.values).toHaveLength(12);
    expect(weekly.values.every((v) => v === 7)).toBe(true);
    expect(weekly.days).toBe(84);
    expect(weekly.labels[11]).toBe('11.24');
    expect(weekly.titles[11]).toBe('11.18 – 11.24');
    expect(weekly.titles[0]).toBe('9.02 – 9.08');
  });

  it('knows the weekday of a calendar date', () => {
    expect(weekdayOf('2026-11-24')).toBe(2);
    expect(weekdayLabel('2026-11-24')).toBe('화');
    expect(shortDate('2026-01-05')).toBe('1.05');
  });
});

describe('axis labels', () => {
  it('always labels the newest point and never packs labels closer than the gap', () => {
    for (const [count, width] of [
      [30, 640],
      [30, 300],
      [13, 640],
      [7, 280],
      [90, 900],
    ] as const) {
      const shown = axisLabelIndexes(count, width);
      expect(shown[shown.length - 1]).toBe(count - 1);
      const step = (shown[1] ?? count) - (shown[0] ?? 0);
      const pxPerPoint = width / (count - 1);
      if (shown.length > 2) expect(step * pxPerPoint).toBeGreaterThanOrEqual(64 - 0.001);
      shown.slice(1).forEach((index, i) => expect(index - (shown[i] ?? 0)).toBe(step));
    }
  });

  it('handles tiny series', () => {
    expect(axisLabelIndexes(0, 500)).toEqual([]);
    expect(axisLabelIndexes(1, 500)).toEqual([0]);
    expect(axisLabelIndexes(2, 10)).toEqual([0, 1]);
  });

  it('thins label arrays from the end', () => {
    const labels = Array.from({ length: 10 }, (_, i) => String(i));
    const sparse = sparseLabels(labels, 4);
    expect(sparse[9]).toBe('9');
    expect(sparse.filter(Boolean).length).toBeLessThanOrEqual(4);
    expect(sparseLabels(['a', 'b'], 4)).toEqual(['a', 'b']);
  });
});

describe('toCsv', () => {
  it('writes a BOM, CRLF rows and quotes special characters', () => {
    const csv = toCsv(
      ['날짜', '메모'],
      [
        ['2026-11-24', '가,나'],
        ['2026-11-23', '그는 "네"라고 했다'],
        ['2026-11-22', 12],
      ],
    );
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe(
      '날짜,메모\r\n2026-11-24,"가,나"\r\n2026-11-23,"그는 ""네""라고 했다"\r\n2026-11-22,12\r\n',
    );
  });
});
