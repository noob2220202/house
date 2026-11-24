import { AssetType } from '@house/shared';
import { verificationDueBefore } from './agency-console.service';
import { parseRegionViewMember, regionViewMember } from './listing-views.service';
import { formatManwon, priceBand } from './similar-listings.service';

describe('similar listings helpers', () => {
  it('formats 만원 amounts as 억 / 만', () => {
    expect(formatManwon(24_000)).toBe('2.4억');
    expect(formatManwon(30_000)).toBe('3억');
    expect(formatManwon(36_049)).toBe('3.6억');
    expect(formatManwon(9_500)).toBe('9,500만');
  });

  it('price band is ±20 % with at least ±500만원', () => {
    expect(priceBand(30_000)).toEqual([24_000, 36_000]);
    expect(priceBand(1_000)).toEqual([500, 1_500]);
    expect(priceBand(null)).toBeNull();
    expect(priceBand(0)).toBeNull();
  });
});

describe('region view members', () => {
  it('round-trips asset type + region key and rejects junk', () => {
    const m = regionViewMember(AssetType.APT, '12150114');
    expect(m).toBe('APT|12150114');
    expect(parseRegionViewMember(m)).toEqual({ assetType: 'APT', regionKey: '12150114' });
    expect(parseRegionViewMember('LAND|1215031022')).toEqual({
      assetType: 'LAND',
      regionKey: '1215031022',
    });
    expect(parseRegionViewMember('CASTLE|12150114')).toBeNull();
    expect(parseRegionViewMember('APT|1215011400')).toBeNull();
    expect(parseRegionViewMember('APT')).toBeNull();
  });
});

describe('verificationDueBefore', () => {
  it('flags a 실매물 확인 whose 30-day validity ends within 7 KST days', () => {
    // 2026-11-24 15:00 KST → KST day starts 2026-11-23T15:00Z; 22 days earlier.
    const now = new Date('2026-11-24T06:00:00Z');
    expect(verificationDueBefore(now).toISOString()).toBe('2026-11-01T15:00:00.000Z');
  });
});
