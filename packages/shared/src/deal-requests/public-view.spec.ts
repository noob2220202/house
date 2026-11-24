import {
  coarseDealRequestPoint,
  dealRequestAreaRange,
  publicDealRequestDescription,
} from './public-view';

describe('deal request pre-grant view', () => {
  it('snaps a point to the centre of its ~200 m cell', () => {
    const a = coarseDealRequestPoint(34.950123, 127.487654);
    expect(a).toEqual({ lat: 34.951, lng: 127.487 });
    // Every point of the same cell maps to the same centre; a neighbouring cell does not.
    expect(coarseDealRequestPoint(34.9501, 127.4861)).toEqual(a);
    expect(coarseDealRequestPoint(34.9519, 127.4879)).toEqual(a);
    expect(coarseDealRequestPoint(34.9521, 127.4879)).not.toEqual(a);
    expect(Math.abs(a.lat! - 34.950123)).toBeLessThanOrEqual(0.001);
    expect(coarseDealRequestPoint(null, 127.4)).toEqual({ lat: null, lng: null });
  });

  it('gives the band of an area', () => {
    expect(dealRequestAreaRange(84.97)).toEqual({ min: 60, max: 85 });
    expect(dealRequestAreaRange(85)).toEqual({ min: 85, max: 102 });
    expect(dealRequestAreaRange(12)).toEqual({ min: 0, max: 20 });
    expect(dealRequestAreaRange(5000)).toEqual({ min: 3300, max: null });
    expect(dealRequestAreaRange(null)).toBeNull();
    expect(dealRequestAreaRange(0)).toBeNull();
  });

  it('keeps only the form flag lines of a description', () => {
    expect(
      publicDealRequestDescription(
        '· 중층 (총 25층)\n· 가격 협의 가능\n· 즉시 입주 가능\n\n101동 1502호 남향, 010 연락 주세요',
      ),
    ).toBe('· 중층 (총 25층)\n· 가격 협의 가능\n· 즉시 입주 가능');
    expect(publicDealRequestDescription('· 입주일 협의 가능')).toBe('· 입주일 협의 가능');
    expect(publicDealRequestDescription('· 15층 (총 25층)\n· 101동')).toBeNull();
    expect(publicDealRequestDescription('남향, 올수리')).toBeNull();
    expect(publicDealRequestDescription(null)).toBeNull();
  });
});
