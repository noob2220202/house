import {
  addMonths,
  complexNameVariants,
  isChosungQuery,
  isValidYearMonth,
  kstDayKey,
  matchesChosung,
  normalizeComplexName,
  normalizeEmdName,
  normalizeJibun,
  parseJibunAddress,
  toChosung,
  yearMonthOf,
  yearMonthRange,
} from './index';
import {
  complexCreateSchema,
  complexTradesQuerySchema,
  tradeSyncRequestSchema,
  yearMonthSchema,
} from '../schemas';

describe('complex name / 지번 normalization', () => {
  it('normalizes names (spaces, brackets, 아파트 suffix, full-width)', () => {
    expect(normalizeComplexName('연향 부영아파트')).toBe('연향부영');
    expect(normalizeComplexName('e편한세상(순천)')).toBe('e편한세상순천');
    expect(normalizeComplexName('ＳＫ뷰')).toBe('sk뷰');
  });

  it('produces variants without brackets and 법정동 prefixes', () => {
    const v = complexNameVariants('연향동부영3차(임대)', '연향동');
    expect(v).toEqual(expect.arrayContaining(['연향동부영3차임대', '연향동부영3차', '부영3차']));
    expect(complexNameVariants('연향부영', '연향동')).toContain('부영');
    // never strips the whole name
    expect(complexNameVariants('연향', '연향동')).toEqual(['연향']);
  });

  it('normalizes 지번 and 법정동 names', () => {
    expect(normalizeJibun('0123-0004')).toBe('123-4');
    expect(normalizeJibun('123-0')).toBe('123');
    expect(normalizeJibun('123')).toBe('123');
    expect(normalizeJibun('산 12-3')).toBe('산12-3');
    expect(normalizeJibun('abc')).toBeNull();
    expect(normalizeJibun(null)).toBeNull();
    expect(normalizeEmdName('해룡면 신대리')).toBe('신대리');
    expect(normalizeEmdName(' 연향동 ')).toBe('연향동');
  });

  it('parses 지번 addresses', () => {
    expect(parseJibunAddress('전라남도 순천시 연향동 1234-5')).toEqual({
      emdName: '연향동',
      jibun: '1234-5',
    });
    expect(parseJibunAddress('전라남도 순천시 해룡면 신대리 2000번지')).toEqual({
      emdName: '신대리',
      jibun: '2000',
    });
    expect(parseJibunAddress('주소 없음')).toEqual({ emdName: null, jibun: null });
  });
});

describe('초성 search', () => {
  it('converts and matches', () => {
    expect(toChosung('연향 부영')).toBe('ㅇㅎㅂㅇ');
    expect(isChosungQuery('ㅇㅎ')).toBe(true);
    expect(isChosungQuery('연향')).toBe(false);
    expect(matchesChosung('연향부영3차', 'ㅂㅇ3')).toBe(true);
    expect(matchesChosung('연향부영3차', 'ㅇㅎ부영')).toBe(true);
    expect(matchesChosung('연향부영3차', 'ㅈㄹ')).toBe(false);
  });
});

describe('year-month helpers', () => {
  it('validates and computes KST months', () => {
    expect(isValidYearMonth(202410)).toBe(true);
    expect(isValidYearMonth(202413)).toBe(false);
    expect(isValidYearMonth(199912)).toBe(false);
    // 2024-10-31T15:30Z is 2024-11-01 00:30 KST
    expect(yearMonthOf(new Date('2024-10-31T15:30:00Z'))).toBe(202411);
    expect(kstDayKey(new Date('2024-10-31T15:30:00Z'))).toBe('20241101');
    expect(addMonths(202401, -1)).toBe(202312);
    expect(addMonths(202411, 3)).toBe(202502);
    expect(yearMonthRange(202411, 202502)).toEqual([202411, 202412, 202501, 202502]);
    expect(yearMonthRange(202502, 202411)).toEqual([]);
  });
});

describe('complexes schemas', () => {
  it('parses yearMonth strings and rejects bad months', () => {
    expect(yearMonthSchema.parse('202410')).toBe(202410);
    expect(yearMonthSchema.safeParse('202400').success).toBe(false);
    expect(tradeSyncRequestSchema.parse({ yearMonth: 202410 })).toEqual({
      yearMonth: 202410,
      kinds: ['APT_TRADE', 'APT_RENT'],
    });
  });

  it('rejects inverted trade ranges', () => {
    expect(complexTradesQuerySchema.safeParse({ fromYm: '202412', toYm: '202401' }).success).toBe(
      false,
    );
    expect(complexTradesQuerySchema.parse({ includeCancelled: 'true' }).includeCancelled).toBe(
      true,
    );
  });

  it('validates complex input', () => {
    const ok = complexCreateSchema.parse({ name: '테스트', lat: 34.95, lng: 127.48 });
    expect(ok.assetType).toBe('APT');
    expect(ok.areaTypes).toEqual([]);
    expect(
      complexCreateSchema.safeParse({ name: 'x', lat: 34.9, lng: 127.4, assetType: 'LAND' })
        .success,
    ).toBe(false);
    expect(
      complexCreateSchema.safeParse({
        name: 'x',
        lat: 34.9,
        lng: 127.4,
        floorsMin: 5,
        floorsMax: 2,
      }).success,
    ).toBe(false);
    expect(
      complexCreateSchema.safeParse({ name: 'x', lat: 34.9, lng: 127.4, jibun: '12-3-4' }).success,
    ).toBe(false);
  });
});
