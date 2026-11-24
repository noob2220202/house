import { describe, expect, it } from 'vitest';
import type { ComplexTrade } from '../api/schemas';
import {
  buildPriceChart,
  formatYm,
  indexToYm,
  linePath,
  monthRange,
  niceStep,
  summarizeStats,
  ymToIndex,
} from './chart';

const month = (yearMonth: number, medianPrice: number, tradeCount = 1) => ({
  yearMonth,
  medianPrice,
  tradeCount,
});
const trade = (
  dealDate: string,
  price: number,
  extra: Partial<ComplexTrade> = {},
): ComplexTrade => ({
  id: dealDate + price,
  dealType: 'SALE',
  dealDate,
  price,
  floor: 10,
  cancelled: false,
  ...extra,
});

describe('month helpers', () => {
  it('round-trips YYYYMM and builds inclusive ranges across years', () => {
    expect(indexToYm(ymToIndex(202412))).toBe(202412);
    expect(monthRange(202411, 202502)).toEqual([202411, 202412, 202501, 202502]);
    expect(formatYm(202401)).toBe('24.01');
  });

  it('picks 1-2-5 tick steps', () => {
    expect(niceStep(8000)).toBe(2000);
    expect(niceStep(3000)).toBe(1000);
    expect(niceStep(30000)).toBe(5000);
    expect(niceStep(0)).toBe(1000);
  });
});

describe('buildPriceChart', () => {
  const stats = [month(202601, 40000), month(202602, 41000), month(202604, 43000)];
  const trades = [
    trade('2026-04-15', 43500),
    trade('2026-02-15', 40500),
    trade('2026-03-10', 99000, { cancelled: true }),
    trade('2025-06-01', 39000), // before the stats window
  ];

  it('returns null without monthly stats', () => {
    expect(buildPriceChart([], trades, 44500)).toBeNull();
  });

  it('spans every month, keeps values inside the domain and places the ask line', () => {
    const model = buildPriceChart(stats, trades, 44500);
    expect(model).not.toBeNull();
    if (!model) return;
    expect(model.months).toEqual([202601, 202602, 202603, 202604]);
    expect(model.min).toBeLessThanOrEqual(40000);
    expect(model.max).toBeGreaterThanOrEqual(44500);
    expect(model.line[0]).toMatchObject({ x: 0, value: 40000 });
    expect(model.line[model.line.length - 1]?.x).toBe(100);
    // cancelled + out-of-window trades are dropped; dots are sorted oldest → newest
    expect(model.dots.map((d) => d.dealDate)).toEqual(['2026-02-15', '2026-04-15']);
    for (const p of [...model.line, ...model.dots]) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
    expect(model.askY).toBeGreaterThanOrEqual(0);
    // higher price → smaller y (closer to the top)
    expect(model.askY ?? 100).toBeLessThan(model.line[0]?.y ?? 0);
    expect(model.ticks[0]?.y).toBe(0);
    expect(model.ticks[model.ticks.length - 1]?.y).toBeCloseTo(100, 5);
  });

  it('omits the ask line when there is no asking price', () => {
    expect(buildPriceChart(stats, trades, null)?.askY).toBeNull();
  });

  it('draws a path through every point', () => {
    const d = linePath(buildPriceChart(stats, [], null)?.line ?? []);
    expect(d.startsWith('M0.00')).toBe(true);
    expect(d.match(/C/g)).toHaveLength(2);
    expect(linePath([])).toBe('');
  });
});

describe('summarizeStats', () => {
  it('compares the latest month with the one twelve months earlier', () => {
    const summary = summarizeStats([
      month(202510, 40000, 2),
      month(202511, 41500, 3),
      month(202605, 42000, 4),
      month(202611, 43500, 5),
    ]);
    expect(summary).toMatchObject({
      latestMedian: 43500,
      latestYm: 202611,
      yearAgoMedian: 41500,
      yearAgoYm: 202511,
      tradeCount12m: 9,
    });
    expect(summary?.changeRatio).toBeCloseTo(0.0482, 3);
  });

  it('handles short series', () => {
    expect(summarizeStats([])).toBeNull();
    expect(summarizeStats([month(202611, 43500, 2)])).toMatchObject({
      changeRatio: null,
      yearAgoMedian: null,
      tradeCount12m: 2,
    });
  });
});
