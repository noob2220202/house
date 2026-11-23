import {
  bannerImpressionBatchSchema,
  bboxSchema,
  CSV_ARRAY_MAX,
  contactPhoneSchema,
  mapSearchQuerySchema,
  oauthProviderParamSchema,
  paginationQuerySchema,
  phoneSchema,
} from './index';

describe('common schemas', () => {
  it('parses pagination defaults and caps page size', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(paginationQuerySchema.safeParse({ pageSize: '1000' }).success).toBe(false);
  });

  it('parses bbox and rejects oversized spans', () => {
    expect(bboxSchema.parse('127.4,34.9,127.5,35.0')).toEqual({
      swLng: 127.4,
      swLat: 34.9,
      neLng: 127.5,
      neLat: 35.0,
    });
    expect(bboxSchema.safeParse('120,30,130,40').success).toBe(false);
    expect(bboxSchema.safeParse('a,b,c,d').success).toBe(false);
  });

  it('normalizes phones', () => {
    expect(phoneSchema.parse('010-1234-5678')).toBe('01012345678');
    expect(phoneSchema.safeParse('02-123-4567').success).toBe(false);
    expect(contactPhoneSchema.parse('061-749-1234')).toBe('0617491234');
    expect(contactPhoneSchema.parse('1588-1234')).toBe('15881234');
    expect(contactPhoneSchema.safeParse('12345').success).toBe(false);
  });

  it('accepts only kakao / naver / google provider slugs', () => {
    expect(oauthProviderParamSchema.parse({ provider: 'kakao' })).toEqual({ provider: 'KAKAO' });
    expect(oauthProviderParamSchema.parse({ provider: 'google' })).toEqual({ provider: 'GOOGLE' });
    expect(oauthProviderParamSchema.safeParse({ provider: 'apple' }).success).toBe(false);
    expect(oauthProviderParamSchema.safeParse({ provider: 'KAKAO' }).success).toBe(false);
  });

  it('parses map search csv filters', () => {
    const q = mapSearchQuerySchema.parse({
      bbox: '127.4,34.9,127.5,35.0',
      zoom: '14',
      dealTypes: 'SALE,JEONSE',
      verifiedOnly: 'true',
    });
    expect(q.dealTypes).toEqual(['SALE', 'JEONSE']);
    expect(q.verifiedOnly).toBe(true);
    expect(q.zoom).toBe(14);
  });

  it('caps csv filter lists at CSV_ARRAY_MAX values', () => {
    const base = { bbox: '127.4,34.9,127.5,35.0', zoom: '14' };
    const ok = Array.from({ length: CSV_ARRAY_MAX }, () => 'SALE').join(',');
    expect(mapSearchQuerySchema.safeParse({ ...base, dealTypes: ok }).success).toBe(true);
    const r = mapSearchQuerySchema.safeParse({ ...base, dealTypes: `${ok},SALE` });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({ code: 'too_big', path: ['dealTypes'] });
  });

  it('rejects an oversized impression batch with a single issue (SEC-04)', () => {
    const r = bannerImpressionBatchSchema.safeParse({ ids: new Array<number>(500_000).fill(0) });
    expect(r.success).toBe(false);
    expect(r.error?.issues).toHaveLength(1);
    expect(r.error?.issues[0]).toMatchObject({ code: 'too_big', path: ['ids'] });
  });
});
