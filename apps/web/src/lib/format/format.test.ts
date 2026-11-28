import { DealType, FloorClass } from '@house/shared';
import { describe, expect, it } from 'vitest';
import {
  floorClassOf,
  formatArea,
  formatAreaBoth,
  formatAreaFilter,
  formatBuiltYear,
  formatCompactCount,
  formatDate,
  formatDateKorean,
  formatDateShort,
  formatDateTime,
  formatDday,
  formatDealPrice,
  formatDealPriceLabeled,
  formatDuration,
  formatFloor,
  formatMaintenanceFee,
  formatManwon,
  formatMonthDay,
  formatMonthly,
  formatPerPyeong,
  formatPercent,
  formatPremium,
  formatPriceAxis,
  formatPriceFilter,
  formatPriceHint,
  formatPriceRange,
  formatPriceShort,
  formatPyeong,
  formatRelativeTime,
  formatSqm,
  formatSupplyExclusive,
  formatTimeOfDay,
  parsePriceInput,
  pyeongToSqm,
  sqmToPyeong,
  toKstDateString,
} from './index';

describe('price', () => {
  it('formats 억/만', () => {
    expect(formatManwon(44500)).toBe('4억 4,500');
    expect(formatManwon(30000)).toBe('3억');
    expect(formatManwon(9500)).toBe('9,500');
    expect(formatManwon(125000)).toBe('12억 5,000');
  });
  it('formats deal prices like the design', () => {
    expect(formatDealPrice({ dealType: DealType.SALE, price: 44500 })).toBe('4억 4,500');
    expect(formatDealPrice({ dealType: DealType.MONTHLY, deposit: 500, monthlyRent: 45 })).toBe(
      '500/45',
    );
    expect(formatDealPrice({ dealType: DealType.MONTHLY, deposit: 2000, monthlyRent: 65 })).toBe(
      '2,000/65',
    );
    expect(
      formatDealPriceLabeled({ dealType: DealType.MONTHLY, deposit: 500, monthlyRent: 45 }),
    ).toBe('월세 500/45');
    expect(formatDealPriceLabeled({ dealType: DealType.JEONSE, price: 21000 })).toBe(
      '전세 2억 1,000',
    );
    expect(formatDealPriceLabeled({ dealType: DealType.PRESALE, price: 41900 })).toBe(
      '분양권 4억 1,900',
    );
    expect(formatDealPrice({ dealType: DealType.SALE })).toBe('가격 협의');
    expect(formatMonthly(10000, 120)).toBe('1억/120');
  });
  it('formats compact marker prices', () => {
    expect(formatPriceShort(44500)).toBe('4.5억');
    expect(formatPriceShort(44000)).toBe('4.4억');
    expect(formatPriceShort(29000)).toBe('2.9억');
    expect(formatPriceShort(30000)).toBe('3억');
    expect(formatPriceShort(9500)).toBe('9,500만');
    expect(formatPriceShort(125000)).toBe('12.5억');
  });
  it('formats ranges and filters', () => {
    expect(formatPriceRange(39000, 48500)).toBe('3억 9,000 ~ 4억 8,500');
    expect(formatPriceRange(39000)).toBe('3억 9,000~');
    expect(formatPriceRange(null, 48500)).toBe('~ 4억 8,500');
    expect(formatPriceRange(30000, 30000)).toBe('3억');
    expect(formatPriceFilter(30000, 50000)).toBe('3억~5억');
    expect(formatPriceFilter(30000)).toBe('3억 이상');
    expect(formatPriceFilter(0, 5000)).toBe('5,000만 이하');
    expect(formatPriceFilter()).toBe('전체');
  });
  it('formats per-pyeong, premium and fees', () => {
    expect(formatPerPyeong(1180)).toBe('1,180만/평');
    expect(formatPremium(2700)).toBe('P +2,700');
    expect(formatPremium(-1200)).toBe('P -1,200');
    expect(formatMaintenanceFee(150000)).toBe('15만원');
    expect(formatMaintenanceFee(85000)).toBe('8만 5천원');
    expect(formatMaintenanceFee(0)).toBe('없음');
    expect(formatMaintenanceFee(null)).toBe('확인 필요');
  });
  it('parses typed prices', () => {
    expect(parsePriceInput('4억 2,000')).toBe(42000);
    expect(parsePriceInput('4.5억')).toBe(45000);
    expect(parsePriceInput('9500')).toBe(9500);
    expect(parsePriceInput('3억')).toBe(30000);
    expect(parsePriceInput('2천')).toBe(2000);
    expect(parsePriceInput('1억 5천')).toBe(15000);
    expect(parsePriceInput('500만원')).toBe(500);
    expect(parsePriceInput('')).toBeNull();
    expect(parsePriceInput('abc')).toBeNull();
    expect(formatPriceHint(42000)).toBe('4억 2,000만원');
    expect(formatPriceHint(30000)).toBe('3억원');
    expect(formatPriceHint(null)).toBe('');
  });
});

describe('area', () => {
  it('converts 평 ↔ ㎡ (1평 = 3.305785㎡)', () => {
    expect(sqmToPyeong(84.98)).toBe(25.7);
    expect(pyeongToSqm(34)).toBe(112.4);
    expect(sqmToPyeong(3.305785, 4)).toBe(1);
  });
  it('formats areas', () => {
    expect(formatPyeong(112.4)).toBe('34평');
    expect(formatSqm(84.98)).toBe('84.98㎡');
    expect(formatSqm(84)).toBe('84㎡');
    expect(formatArea(112.4, 'pyeong')).toBe('34평');
    expect(formatArea(112.4, 'sqm')).toBe('112.4㎡');
    expect(formatAreaBoth(84.98)).toBe('84.98㎡ (25.7평)');
    expect(formatSupplyExclusive(112.4, 84.98)).toBe('공급 112.4㎡ · 전용 84.98㎡');
    expect(formatAreaFilter(99.17, 132.23)).toBe('30평~40평');
    expect(formatAreaFilter(99.17, null)).toBe('30평 이상');
    expect(formatAreaFilter(null, null)).toBe('전체');
  });
});

describe('floor', () => {
  it('classifies 저/중/고 by thirds', () => {
    expect(floorClassOf(1, 25)).toBe(FloorClass.LOW);
    expect(floorClassOf(8, 25)).toBe(FloorClass.LOW);
    expect(floorClassOf(9, 25)).toBe(FloorClass.MID);
    expect(floorClassOf(16, 25)).toBe(FloorClass.MID);
    expect(floorClassOf(17, 25)).toBe(FloorClass.HIGH);
    expect(floorClassOf(25, 25)).toBe(FloorClass.HIGH);
  });
  it('formats floors like the design', () => {
    expect(formatFloor({ floorClass: FloorClass.HIGH, totalFloors: 25 })).toBe('고/25층');
    expect(formatFloor({ floorClass: FloorClass.MID, totalFloors: 20 })).toBe('중/20층');
    expect(formatFloor({ floor: 3, totalFloors: 4 })).toBe('3/4층');
    expect(formatFloor({ floor: 20, totalFloors: 25, showExact: false })).toBe('고/25층');
    expect(formatFloor({ floor: -1, totalFloors: 5 })).toBe('지하 1/5층');
    expect(formatFloor({ floorClass: FloorClass.LOW })).toBe('저층');
    expect(formatFloor({})).toBe('');
    // A summary sends both the floor and its class: the known floor wins (11/13층, not 고/13층).
    expect(formatFloor({ floor: 11, totalFloors: 13, floorClass: FloorClass.HIGH })).toBe(
      '11/13층',
    );
    expect(formatFloor({ floor: null, totalFloors: 13, floorClass: FloorClass.HIGH })).toBe(
      '고/13층',
    );
  });
});

describe('date (Asia/Seoul)', () => {
  it('formats in KST regardless of the host time zone', () => {
    // 2026-11-22 15:30 UTC = 2026-11-23 00:30 KST
    const iso = '2026-11-22T15:30:00.000Z';
    expect(formatDateShort(iso)).toBe('26.11.23');
    expect(formatDate(iso)).toBe('2026.11.23');
    expect(formatDateTime(iso)).toBe('2026.11.23 00:30');
    expect(formatDateKorean(iso)).toBe('2026년 11월 23일');
    expect(formatMonthDay(iso, true)).toBe('11.23 월');
    expect(toKstDateString(iso)).toBe('2026-11-23');
  });
  it('treats date-only strings as KST calendar dates', () => {
    expect(formatDateShort('2026-11-22')).toBe('26.11.22');
    expect(formatDateShort('not a date')).toBe('');
  });
  it('formats relative time', () => {
    const now = '2026-11-23T05:20:00.000Z'; // 14:20 KST
    expect(formatRelativeTime('2026-11-23T05:19:40.000Z', now)).toBe('방금 전');
    expect(formatRelativeTime('2026-11-23T05:08:00.000Z', now)).toBe('12분 전');
    expect(formatRelativeTime('2026-11-23T02:20:00.000Z', now)).toBe('3시간 전');
    expect(formatRelativeTime('2026-11-22T04:00:00.000Z', now)).toBe('어제');
    expect(formatRelativeTime('2026-11-20T03:00:00.000Z', now)).toBe('3일 전');
    expect(formatRelativeTime('2026-11-09T03:00:00.000Z', now)).toBe('2주 전');
    expect(formatRelativeTime('2026-10-02T03:00:00.000Z', now)).toBe('26.10.02');
  });
  it('formats D-day', () => {
    const now = '2026-11-23T05:20:00.000Z';
    expect(formatDday('2026-11-26', now)).toBe('D-3');
    expect(formatDday('2026-11-23', now)).toBe('D-DAY');
    expect(formatDday('2026-11-20', now)).toBe('종료');
  });
});

describe('number', () => {
  it('formats compact counts and percents', () => {
    expect(formatCompactCount(8940)).toBe('8,940');
    expect(formatCompactCount(12000)).toBe('1.2만');
    expect(formatCompactCount(21000)).toBe('2.1만');
    expect(formatPercent(0.0862)).toBe('8.6%');
  });
});

describe('shared axis / time / year formatters', () => {
  it('labels chart axes in 만 / 억 with trailing zeros dropped', () => {
    expect(formatPriceAxis(9500)).toBe('9,500만');
    expect(formatPriceAxis(44000)).toBe('4.4억');
    expect(formatPriceAxis(42500)).toBe('4.25억');
    expect(formatPriceAxis(120000)).toBe('12억');
    expect(formatPriceAxis(42580)).toBe('4.26억');
    expect(formatPriceAxis(42580, 1)).toBe('4.3억');
    expect(formatPriceAxis(0)).toBe('0만');
  });
  it('labels the built year as 준공 or 입주 예정', () => {
    const now = '2026-11-23T10:00:00+09:00';
    expect(formatBuiltYear(2019, now)).toBe('2019년 준공');
    expect(formatBuiltYear(2026, now)).toBe('2026년 준공');
    expect(formatBuiltYear(2027, now)).toBe('2027년 입주 예정');
    // New Year's Eve in UTC is already 2027 in Seoul.
    expect(formatBuiltYear(2027, '2026-12-31T16:00:00Z')).toBe('2027년 준공');
  });
  it('formats video durations', () => {
    expect(formatDuration(872)).toBe('14:32');
    expect(formatDuration(308)).toBe('5:08');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(-3)).toBe('0:00');
  });
  it('formats the time of day in Asia/Seoul', () => {
    expect(formatTimeOfDay('2026-11-23T06:42:00Z')).toBe('오후 3:42');
    expect(formatTimeOfDay('2026-11-23T00:05:00Z')).toBe('오전 9:05');
    expect(formatTimeOfDay('nope')).toBe('');
  });
});
