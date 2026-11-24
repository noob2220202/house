import { BannerTargeting } from '@house/shared';
import { describe, expect, it } from 'vitest';
import { patchQuery } from '../hooks/useUrlState';
import {
  addDays,
  dayDiff,
  endOfKstDay,
  formatDayFull,
  formatDayShort,
  formatPeriodShort,
  isDay,
  kstToday,
  startOfKstDay,
  toKstDay,
} from './dates';
import { advertiserLine, targetSummary } from './summary';

describe('KST day helpers', () => {
  it('maps instants to the KST calendar day', () => {
    expect(toKstDay('2026-11-30T23:59:59+09:00')).toBe('2026-11-30');
    expect(toKstDay('2026-11-30T15:00:00Z')).toBe('2026-12-01');
    expect(kstToday(new Date('2026-11-24T14:59:59Z'))).toBe('2026-11-24');
    expect(kstToday(new Date('2026-11-24T15:00:00Z'))).toBe('2026-11-25');
  });

  it('builds inclusive day bounds with the KST offset', () => {
    expect(startOfKstDay('2026-12-01')).toBe('2026-12-01T00:00:00+09:00');
    expect(endOfKstDay('2026-12-31')).toBe('2026-12-31T23:59:59+09:00');
    expect(toKstDay(endOfKstDay('2026-12-31'))).toBe('2026-12-31');
  });

  it('validates and does day arithmetic across months and years', () => {
    expect(isDay('2026-11-24')).toBe(true);
    expect(isDay('2026-13-01')).toBe(false);
    expect(isDay('26-11-24')).toBe(false);
    expect(isDay('')).toBe(false);
    expect(addDays('2026-12-25', 30)).toBe('2027-01-24');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(dayDiff('2026-11-24', '2026-12-01')).toBe(7);
    expect(dayDiff('2026-12-01', '2026-11-24')).toBe(-7);
  });

  it('formats days and periods like the design', () => {
    expect(formatDayShort('2026-11-01')).toBe('11.01');
    expect(formatDayFull('2026-11-01')).toBe('2026.11.01');
    expect(formatDayShort('nope')).toBe('');
    expect(formatPeriodShort('2026-11-01T00:00:00+09:00', '2026-11-30T23:59:59+09:00')).toBe(
      '11.01 – 11.30',
    );
    expect(formatPeriodShort('2026-12-20T00:00:00+09:00', '2027-01-19T23:59:59+09:00')).toBe(
      '26.12.20 – 27.01.19',
    );
  });
});

describe('targetSummary', () => {
  const base = { targetRegions: [], targetComplexes: [] };
  const region = (name: string) => ({ code: name, name });

  it('summarises region targets (three or more are shortened)', () => {
    expect(targetSummary({ ...base, targeting: BannerTargeting.ALL })).toBe('전체');
    expect(
      targetSummary({
        ...base,
        targeting: BannerTargeting.REGIONS,
        targetRegions: [region('신대지구')],
      }),
    ).toBe('신대지구');
    expect(
      targetSummary({
        ...base,
        targeting: BannerTargeting.REGIONS,
        targetRegions: [region('조례동'), region('연향동')],
      }),
    ).toBe('조례동·연향동');
    expect(
      targetSummary({
        ...base,
        targeting: BannerTargeting.REGIONS,
        targetRegions: [region('신대지구'), region('선월지구'), region('연향동')],
      }),
    ).toBe('신대·선월·연향');
    expect(
      targetSummary({
        ...base,
        targeting: BannerTargeting.REGIONS,
        targetRegions: ['신대지구', '선월지구', '연향동', '조례동', '해룡면'].map(region),
      }),
    ).toBe('신대·선월·연향 외 2');
  });

  it('summarises complex targets and missing targets', () => {
    const complex = (name: string) => ({ id: name, name });
    expect(
      targetSummary({
        ...base,
        targeting: BannerTargeting.COMPLEXES,
        targetComplexes: [complex('신대 레이크파크 1단지'), complex('신대 레이크파크 2단지')],
      }),
    ).toBe('신대 레이크파크 1단지 외 1');
    expect(targetSummary({ ...base, targeting: BannerTargeting.COMPLEXES })).toBe('단지 미지정');
    expect(targetSummary({ ...base, targeting: BannerTargeting.REGIONS })).toBe('지역 미지정');
  });
});

describe('advertiserLine', () => {
  const agency = { id: 'a1', name: '호수공원 공인중개사사무소', representativeName: '한서윤' };

  it('shows the 대표 for office banners titled with the office name', () => {
    expect(
      advertiserLine({ title: '호수공원 공인중개사사무소', advertiserName: agency.name, agency }),
    ).toBe('대표 한서윤');
  });

  it('shows the advertiser otherwise', () => {
    expect(
      advertiserLine({ title: '신대 레이크파크 전문', advertiserName: agency.name, agency }),
    ).toBe(agency.name);
    expect(
      advertiserLine({ title: '이사 예약', advertiserName: '늘봄 이사·청소', agency: null }),
    ).toBe('늘봄 이사·청소');
    expect(advertiserLine({ title: '무제', advertiserName: null, agency: null })).toBe(
      '광고주 미지정',
    );
  });
});

describe('patchQuery', () => {
  it('sets, replaces and removes keys', () => {
    expect(patchQuery('slot=MAP_AD&page=2', { page: null, status: 'ACTIVE' })).toBe(
      'slot=MAP_AD&status=ACTIVE',
    );
    expect(patchQuery('', { edit: 'abc' })).toBe('edit=abc');
    expect(patchQuery('edit=abc', { edit: null, new: 1 })).toBe('new=1');
    expect(patchQuery('slot=MAP_AD', { slot: '' })).toBe('');
    expect(patchQuery('slot=MAP_AD', { slot: undefined })).toBe('');
  });
});
