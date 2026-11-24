import { emdCodesOfRegionKey, regionKeyOf } from './region-key';

describe('regionKeyOf', () => {
  it('collapses a 10-digit 읍면동 code to 8 digits and keeps 리 codes', () => {
    expect(regionKeyOf('1215011400')).toBe('12150114');
    expect(regionKeyOf('12150114')).toBe('12150114');
    expect(regionKeyOf('1215031022')).toBe('1215031022');
  });

  it('rejects missing, 시군구-level and malformed codes', () => {
    expect(regionKeyOf(null)).toBeNull();
    expect(regionKeyOf('12150')).toBeNull();
    expect(regionKeyOf('121501140')).toBeNull();
    expect(regionKeyOf('12150abc')).toBeNull();
  });

  it('lists both spellings of a 읍면동 key', () => {
    expect(emdCodesOfRegionKey('12150114')).toEqual(['12150114', '1215011400']);
    expect(emdCodesOfRegionKey('1215031022')).toEqual(['1215031022']);
  });
});
