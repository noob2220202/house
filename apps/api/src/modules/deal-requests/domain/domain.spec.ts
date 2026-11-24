import { DealRequestType, DealType } from '@house/shared';
import { matchScore, rankByMatch, type MatchListing, type MatchRequest } from './listing-match';
import { regionNameOf, type RegionNameRow } from './region-name';
import { nameKey, roadKey, roadNameOf } from './road-address';

describe('deal-requests form domain', () => {
  it('roadKey ignores the 시도 / 시군구 spelling and trailing extras', () => {
    expect(roadKey('전남 순천시 해룡면 신대2로 40')).toBe('신대2로40');
    expect(roadKey('전남광주통합특별시 순천시 해룡면 신대2로 40 (신대리)')).toBe('신대2로40');
    expect(roadKey('전라남도 순천시 연향3로 20-1')).toBe('연향3로20-1');
    expect(roadKey('순천시 조례1길 7')).toBe('조례1길7');
    expect(roadKey('순천시 왕지로 12번길 3')).toBe('왕지로12번길3');
    expect(roadKey('순천시 왕지로12번길 3')).toBe('왕지로12번길3');
    expect(roadKey('순천시 해룡면 신대리 1978')).toBeNull();
    expect(roadNameOf('전남 순천시 해룡면 신대2로 40')).toBe('신대2로');
    expect(nameKey(' 레이크파크 1단지 ')).toBe('레이크파크1단지');
  });

  it('regionNameOf names 읍면동 and 리 codes', () => {
    const rows: RegionNameRow[] = [
      { code: '12150360', name: '해룡면', level: 'EMD', parent: null },
      { code: '1215036022', name: '신대리', level: 'RI', parent: { name: '해룡면' } },
      { code: '1215012700', name: '조례동', level: 'EMD', parent: null },
    ];
    const byCode = new Map(rows.map((r) => [r.code, r]));
    expect(regionNameOf('1215036022', byCode)).toBe('해룡면 신대리');
    expect(regionNameOf('1215036099', byCode)).toBe('해룡면');
    expect(regionNameOf('12150127', byCode)).toBe('조례동');
    expect(regionNameOf('12150', byCode)).toBeNull();
    expect(regionNameOf(null, byCode)).toBeNull();
  });

  describe('listing match', () => {
    const wanted: MatchRequest = {
      type: DealRequestType.WANTED,
      assetType: 'APT',
      dealTypes: [DealType.JEONSE],
      emdCode: null,
      complexId: null,
      regionCodes: ['12150127'],
      complexIds: [],
      priceMin: null,
      priceMax: null,
      depositMin: 20000,
      depositMax: 30000,
      rentMin: null,
      rentMax: null,
      areaMin: 59,
      areaMax: 85,
      roomsMin: 3,
    };
    const listing = (over: Partial<MatchListing> = {}): MatchListing => ({
      assetType: 'APT',
      dealType: DealType.JEONSE,
      price: 28000,
      deposit: null,
      monthlyRent: null,
      exclusiveArea: 84.9,
      rooms: 3,
      emdCode: '1215012700',
      complexId: null,
      ...over,
    });

    it('scores every stated condition (전세 budget on `price`)', () => {
      expect(matchScore(wanted, listing())).toEqual({ full: true, score: 6 });
      expect(matchScore(wanted, listing({ price: 35000 }))).toEqual({ full: false, score: 5 });
      expect(matchScore(wanted, listing({ dealType: DealType.SALE }))).toMatchObject({
        full: false,
      });
    });

    it('ranks full matches first and keeps the incoming order on ties', () => {
      const a = listing({ price: 35000 });
      const b = listing();
      const c = listing({ assetType: 'OFFICETEL', emdCode: '1215099900' });
      const d = listing();
      expect(rankByMatch(wanted, [a, b, c, d])).toEqual([b, d, a, c]);
    });

    it('a 내놓기 request matches the same complex, else the same 읍면동', () => {
      const sell: MatchRequest = {
        ...wanted,
        type: DealRequestType.SELL_OR_LEASE,
        dealTypes: [DealType.SALE],
        emdCode: '1215012700',
        complexId: 'c1',
        regionCodes: [],
      };
      const sale = (over: Partial<MatchListing>) =>
        listing({ dealType: DealType.SALE, price: 40000, ...over });
      expect(matchScore(sell, sale({ complexId: 'c1', emdCode: null }))).toEqual({
        full: true,
        score: 3,
      });
      expect(matchScore(sell, sale({ emdCode: '1215012799' })).score).toBe(3);
      expect(matchScore(sell, sale({ emdCode: '1215099900' })).score).toBe(2);
    });
  });
});
