import { AssetType } from '@house/shared';
import { Logger } from '@nestjs/common';
import type { AppConfig } from '../../config/app-config.service';
import {
  GeocoderUnavailableError,
  KakaoGeocoder,
  parseAddressSearch,
  parseRegionCode,
} from './clients/kakao-geocode.client';
import { GEOCODE_MAX_RESULTS, KAKAO_LOCAL } from './constants';
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

describe('Kakao Local geocoder', () => {
  /** GET /v2/local/search/address.json, trimmed from a real answer (전남 순천시 신대1로 18). */
  const addressFixture = {
    meta: { total_count: 3, pageable_count: 3, is_end: true },
    documents: [
      {
        address_name: '전남 순천시 해룡면 신대리 1978',
        address_type: 'REGION_ADDR',
        x: '127.5551',
        y: '34.9362',
        address: {
          address_name: '전남 순천시 해룡면 신대리 1978',
          b_code: '4615031022',
          h_code: '4615031000',
          region_1depth_name: '전남',
          region_2depth_name: '순천시',
          region_3depth_name: '해룡면 신대리',
        },
        road_address: {
          address_name: '전남 순천시 해룡면 신대1로 18',
          building_name: '신대프라자',
          zone_no: '58027',
          road_name: '신대1로',
        },
      },
      // 지번-only hit (no 도로명): the 지번 address is the display address.
      {
        address_name: '전남 순천시 해룡면 신대리 산 1',
        address_type: 'REGION_ADDR',
        x: '127.56',
        y: '34.93',
        address: { address_name: '전남 순천시 해룡면 신대리 산 1', b_code: 'x' },
        road_address: null,
      },
      {
        address_name: '',
        address_type: 'REGION',
        x: '1',
        y: '2',
        address: null,
        road_address: null,
      },
      {
        address_name: '어딘가',
        address_type: 'ROAD',
        x: 'NaN',
        y: '34',
        address: null,
        road_address: null,
      },
    ],
  };

  it('maps address documents (도로명, 지번, 우편번호, 건물명, coordinates, b_code)', () => {
    expect(parseAddressSearch(addressFixture)).toEqual([
      {
        roadAddress: '전남 순천시 해룡면 신대1로 18',
        jibunAddress: '전남 순천시 해룡면 신대리 1978',
        zipCode: '58027',
        buildingName: '신대프라자',
        lat: 34.9362,
        lng: 127.5551,
        legalCode: '4615031022',
      },
      {
        roadAddress: '전남 순천시 해룡면 신대리 산 1',
        jibunAddress: '전남 순천시 해룡면 신대리 산 1',
        zipCode: null,
        buildingName: null,
        lat: 34.93,
        lng: 127.56,
        legalCode: null,
      },
    ]);
    expect(parseAddressSearch({ meta: {}, documents: [] })).toEqual([]);
    expect(() => parseAddressSearch({ errorType: 'InvalidArgument', message: 'bad' })).toThrow(
      GeocoderUnavailableError,
    );
    expect(() => parseAddressSearch('nope')).toThrow();
  });

  it('reads the 법정동 (region_type B) code of coord2regioncode', () => {
    expect(
      parseRegionCode({
        meta: { total_count: 2 },
        documents: [
          { region_type: 'H', code: '4615031000', address_name: '전남 순천시 해룡면' },
          { region_type: 'B', code: '4615031022', address_name: '전남 순천시 해룡면 신대리' },
        ],
      }),
    ).toBe('4615031022');
    expect(parseRegionCode({ documents: [{ region_type: 'H', code: '4615031000' }] })).toBeNull();
    expect(parseRegionCode({ documents: [{ region_type: 'B', code: '46150' }] })).toBeNull();
    expect(parseRegionCode({ errorType: 'AccessDeniedError' })).toBeNull();
  });

  describe('KakaoGeocoder (HTTP)', () => {
    const geocoderWith = (env: Record<string, string | undefined>) =>
      new KakaoGeocoder({ get: (key: string) => env[key] } as unknown as AppConfig);
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      });
    const sentUrl = (spy: jest.SpyInstance) => new URL(spy.mock.calls[0]?.[0] as URL);
    const sentHeaders = (spy: jest.SpyInstance) =>
      new Headers((spy.mock.calls[0]?.[1] as RequestInit | undefined)?.headers);

    afterEach(() => jest.restoreAllMocks());
    beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));

    it('is configured by KAKAO_REST_API_KEY, falling back to KAKAO_CLIENT_ID', () => {
      expect(geocoderWith({}).isConfigured()).toBe(false);
      expect(geocoderWith({ NAVER_MAP_CLIENT_ID: 'legacy' }).isConfigured()).toBe(false);
      expect(geocoderWith({ KAKAO_CLIENT_ID: 'login-rest' }).isConfigured()).toBe(true);
      expect(geocoderWith({ KAKAO_REST_API_KEY: 'rest' }).isConfigured()).toBe(true);
    });

    it('searches addresses with "KakaoAK <REST key>" (dedicated key wins)', async () => {
      const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(json(addressFixture));
      const hits = await geocoderWith({
        KAKAO_REST_API_KEY: 'rest-key',
        KAKAO_CLIENT_ID: 'login-key',
      }).geocode('순천시 신대1로 18');
      expect(hits).toHaveLength(2);
      const url = sentUrl(spy);
      expect(`${url.origin}${url.pathname}`).toBe(KAKAO_LOCAL.ADDRESS_SEARCH);
      expect(url.searchParams.get('query')).toBe('순천시 신대1로 18');
      expect(url.searchParams.get('size')).toBe(String(GEOCODE_MAX_RESULTS));
      expect(sentHeaders(spy).get('authorization')).toBe('KakaoAK rest-key');
    });

    it('looks up the 법정동 code of a point (x = lng, y = lat) with the login key', async () => {
      const spy = jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(json({ documents: [{ region_type: 'B', code: '1215011400' }] }));
      expect(
        await geocoderWith({ KAKAO_CLIENT_ID: 'login-key' }).legalCode(34.9466, 127.5161),
      ).toBe('1215011400');
      const url = sentUrl(spy);
      expect(`${url.origin}${url.pathname}`).toBe(KAKAO_LOCAL.COORD_TO_REGION);
      expect([url.searchParams.get('x'), url.searchParams.get('y')]).toEqual([
        '127.5161',
        '34.9466',
      ]);
      expect(sentHeaders(spy).get('authorization')).toBe('KakaoAK login-key');
    });

    it('turns HTTP / network / JSON failures into GeocoderUnavailableError (reverse → null)', async () => {
      const g = geocoderWith({ KAKAO_CLIENT_ID: 'k' });
      jest
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          json(
            {
              errorType: 'NotAuthorizedError',
              message: 'App(x) disabled OPEN_MAP_AND_LOCAL service.',
            },
            403,
          ),
        )
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce(new Response('<html>', { status: 200 }))
        .mockResolvedValueOnce(json({}, 500));
      await expect(g.geocode('순천시 a')).rejects.toThrow(/HTTP 403 .*OPEN_MAP_AND_LOCAL/);
      await expect(g.geocode('순천시 a')).rejects.toThrow(GeocoderUnavailableError);
      await expect(g.geocode('순천시 a')).rejects.toThrow('invalid JSON');
      await expect(g.legalCode(34.9, 127.5)).resolves.toBeNull();
    });
  });
});
