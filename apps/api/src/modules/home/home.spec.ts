import { AssetType } from '@house/shared';
import { parseGeocodeResponse, parseLegalCode } from './clients/naver-geocode.client';
import {
  geocodeQuerySchema,
  interestRegionsInputSchema,
  popularRegionsQuerySchema,
  searchSuggestQuerySchema,
} from './dto';
import { perPyeongBasisFor, rankRegions, viewsFor } from './services/home-stats.service';

describe('home stats helpers', () => {
  it('picks the 평당가 basis like the web mock', () => {
    expect(perPyeongBasisFor(undefined)).toBe('APT');
    expect(perPyeongBasisFor([AssetType.ONEROOM, AssetType.APT])).toBe('APT');
    expect(perPyeongBasisFor([AssetType.LAND])).toBe('LAND');
    expect(perPyeongBasisFor([AssetType.COMMERCIAL])).toBe('COMMERCIAL');
    expect(perPyeongBasisFor([AssetType.ONEROOM, AssetType.OFFICETEL])).toBeNull();
  });

  it('sums views of the selected categories', () => {
    const views = new Map([
      [
        'A',
        new Map([
          [AssetType.APT, 3],
          [AssetType.LAND, 2],
        ]),
      ],
      ['B', new Map([[AssetType.LAND, 1]])],
    ]);
    expect(viewsFor(views, undefined)).toEqual(
      new Map([
        ['A', 5],
        ['B', 1],
      ]),
    );
    expect(viewsFor(views, [AssetType.APT])).toEqual(new Map([['A', 3]]));
  });

  it('ranks by views, then listings, with the change against last week', () => {
    const candidates = [
      { key: 'A', listingCount: 10 },
      { key: 'B', listingCount: 5 },
      { key: 'C', listingCount: 1 },
    ];
    const ranked = rankRegions(
      candidates,
      new Map([
        ['C', 9],
        ['B', 4],
      ]),
      new Map([
        ['B', 7],
        ['C', 1],
      ]),
    );
    expect(ranked).toEqual([
      { key: 'C', rank: 1, rankDelta: 1, weeklyViewCount: 9 },
      { key: 'B', rank: 2, rankDelta: -1, weeklyViewCount: 4 },
      { key: 'A', rank: 3, rankDelta: null, weeklyViewCount: 0 },
    ]);
  });
});

describe('home DTOs', () => {
  it('interest regions: dedupes, canonicalizes legacy codes, caps at 5', () => {
    expect(
      interestRegionsInputSchema.parse({
        regionKeys: ['sindae', '46150114', 'sindae'],
        notify: true,
      }),
    ).toEqual({ regionKeys: ['sindae', '12150114'], notify: true });
    expect(
      interestRegionsInputSchema.safeParse({
        regionKeys: ['a', 'b', 'c', 'd', 'e', 'f'],
        notify: true,
      }).success,
    ).toBe(false);
    expect(
      interestRegionsInputSchema.safeParse({ regionKeys: ['a b'], notify: true }).success,
    ).toBe(false);
  });

  it('geocode query: whitespace collapsed, 2…100 characters', () => {
    expect(geocodeQuerySchema.parse({ query: ' 신대1로\t 18 ' })).toEqual({ query: '신대1로 18' });
    expect(geocodeQuerySchema.safeParse({ query: ' 가 ' }).success).toBe(false);
    expect(geocodeQuerySchema.safeParse({}).success).toBe(false);
    expect(geocodeQuerySchema.safeParse({ query: 'x'.repeat(101) }).success).toBe(false);
  });

  it('clamps limits like the mocks and cuts long search terms', () => {
    expect(popularRegionsQuerySchema.parse({ limit: '999' }).limit).toBe(50);
    expect(popularRegionsQuerySchema.parse({ limit: 'abc' }).limit).toBe(10);
    expect(popularRegionsQuerySchema.parse({ assetTypes: 'APT,LAND' }).assetTypes).toEqual([
      'APT',
      'LAND',
    ]);
    expect(searchSuggestQuerySchema.parse({ q: '가'.repeat(80), limit: '0' })).toEqual({
      q: '가'.repeat(50),
      limit: 1,
    });
    expect(searchSuggestQuerySchema.parse({})).toEqual({ q: '', limit: 8 });
  });
});

describe('Naver Maps payload parsing', () => {
  it('maps geocode addresses (road, 지번, 우편번호, 건물명, coordinates)', () => {
    const hits = parseGeocodeResponse({
      status: 'OK',
      meta: { totalCount: 2 },
      addresses: [
        {
          roadAddress: '전라남도 순천시 해룡면 신대1로 18',
          jibunAddress: '전라남도 순천시 해룡면 신대리 1978',
          x: '127.5551',
          y: '34.9362',
          addressElements: [
            { types: ['POSTAL_CODE'], longName: '58027' },
            { types: ['BUILDING_NAME'], longName: '신대프라자' },
          ],
        },
        { roadAddress: '', jibunAddress: '', x: '1', y: '2', addressElements: [] },
        { roadAddress: '어딘가', jibunAddress: null, x: 'NaN', y: '34', addressElements: [] },
      ],
    });
    expect(hits).toEqual([
      {
        roadAddress: '전라남도 순천시 해룡면 신대1로 18',
        jibunAddress: '전라남도 순천시 해룡면 신대리 1978',
        zipCode: '58027',
        buildingName: '신대프라자',
        lat: 34.9362,
        lng: 127.5551,
      },
    ]);
    expect(() => parseGeocodeResponse({ status: 'INVALID_REQUEST', errorMessage: 'bad' })).toThrow(
      'bad',
    );
    expect(() => parseGeocodeResponse('nope')).toThrow();
  });

  it('reads the legalcode id of a reverse-geocoding answer', () => {
    expect(
      parseLegalCode({
        status: { code: 0, name: 'ok' },
        results: [{ name: 'legalcode', code: { id: '4615031022', type: 'L' } }],
      }),
    ).toBe('4615031022');
    expect(parseLegalCode({ status: { code: 3 }, results: [] })).toBeNull();
    expect(
      parseLegalCode({ status: { code: 0 }, results: [{ name: 'legalcode', code: { id: 'x' } }] }),
    ).toBeNull();
  });
});
