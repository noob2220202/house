import { BannerStatus, computeScheduleStatus } from '@house/shared';
import { liveWhere, scheduleStatusWhere, ttlUntilNextBoundary } from './schedule';
import { peakConcurrency } from './slot-capacity';
import { regionCodePrefixes } from './targeting';

const t = (iso: string): Date => new Date(`2026-12-01T${iso}:00Z`);
const w = (s: string, e: string) => ({ startAt: t(s), endAt: t(e) });

describe('peakConcurrency', () => {
  it('is 0 without overlapping intervals', () => {
    expect(
      peakConcurrency(w('10:00', '12:00'), [w('08:00', '10:00'), w('12:00', '13:00')]),
    ).toEqual({ peak: 0, at: null });
  });

  it('counts the maximum simultaneous overlap, not the number of overlapping intervals', () => {
    const others = [w('09:00', '10:30'), w('11:00', '13:00'), w('11:30', '11:45')];
    const r = peakConcurrency(w('10:00', '12:00'), others);
    expect(r.peak).toBe(2);
    expect(r.at).toEqual(t('11:30'));
  });

  it('treats intervals as half-open (end == start does not overlap)', () => {
    expect(
      peakConcurrency(w('10:00', '12:00'), [w('09:00', '11:00'), w('11:00', '12:00')]).peak,
    ).toBe(1);
  });

  it('clips intervals to the window', () => {
    expect(
      peakConcurrency(w('10:00', '11:00'), [w('08:00', '20:00'), w('11:00', '20:00')]).peak,
    ).toBe(1);
  });
});

describe('scheduleStatusWhere', () => {
  const now = t('12:00');
  const rows = [
    { paused: false, ...w('10:00', '13:00') },
    { paused: true, ...w('10:00', '13:00') },
    { paused: false, ...w('12:30', '13:00') },
    { paused: false, ...w('10:00', '12:00') },
    { paused: true, ...w('10:00', '11:00') },
  ];

  /** Tiny evaluator of the generated where fragment, to compare with computeScheduleStatus. */
  function matches(
    row: (typeof rows)[number],
    where: ReturnType<typeof scheduleStatusWhere>,
  ): boolean {
    if (where.paused !== undefined && row.paused !== where.paused) return false;
    for (const field of ['startAt', 'endAt'] as const) {
      const c = where[field];
      if (c?.lte && !(row[field] <= c.lte)) return false;
      if (c?.gt && !(row[field] > c.gt)) return false;
    }
    return true;
  }

  it.each(Object.values(BannerStatus))('agrees with computeScheduleStatus for %s', (status) => {
    for (const row of rows) {
      expect(matches(row, scheduleStatusWhere(status, now))).toBe(
        computeScheduleStatus(row, now) === status,
      );
    }
  });

  it('liveWhere equals ACTIVE', () => {
    expect(liveWhere(now)).toEqual(scheduleStatusWhere(BannerStatus.ACTIVE, now));
  });
});

describe('ttlUntilNextBoundary', () => {
  const now = t('12:00');
  it('stops at the nearest future boundary', () => {
    expect(ttlUntilNextBoundary([new Date(now.getTime() + 12_500), null], now, 60)).toBe(13);
  });
  it('ignores past boundaries and clamps to max', () => {
    expect(ttlUntilNextBoundary([t('11:00'), t('18:00')], now, 60)).toBe(60);
  });
  it('never returns less than 1', () => {
    expect(ttlUntilNextBoundary([new Date(now.getTime() + 1)], now, 60)).toBe(1);
  });
});

describe('regionCodePrefixes', () => {
  it('expands 법정동 codes to every ancestor level', () => {
    expect(regionCodePrefixes(['1215025021'])).toEqual(['12', '12150', '12150250', '1215025021']);
  });
  it('canonicalizes legacy 46150… codes first', () => {
    expect(regionCodePrefixes(['4615025021'])).toEqual(['12', '12150', '12150250', '1215025021']);
  });
  it('treats a 10-digit 읍면동 code as its 8-digit stored form', () => {
    expect(regionCodePrefixes(['1215013300'])).toEqual(['12', '12150', '12150133']);
    expect(regionCodePrefixes(['4615013300'])).toEqual(['12', '12150', '12150133']);
  });
  it('merges, dedupes and skips invalid/empty codes', () => {
    expect(regionCodePrefixes(['12150', '12150101', null, undefined, 'abc', '461'])).toEqual([
      '12',
      '12150',
      '12150101',
    ]);
  });
});
