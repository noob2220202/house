import type { RegionView } from '@house/shared';
import { regionInfoIndex, resolveRegionInfo } from './region-info';

const region = (code: string, name: string, level: 'EMD' | 'RI', parentCode: string | null) =>
  ({
    code,
    name,
    fullName: name,
    level,
    parentCode,
    lat: 34.9,
    lng: 127.5,
    isActive: true,
  }) as RegionView;

describe('regionInfoIndex', () => {
  it('keys 읍면동 by 8 digits and names 리 with their 읍면', () => {
    const index = regionInfoIndex([
      region('1215011400', '연향동', 'EMD', '12150'),
      region('12150310', '해룡면', 'EMD', '12150'),
      region('1215031022', '신대리', 'RI', '12150310'),
    ]);
    expect(index.get('12150114')?.name).toBe('연향동');
    expect(index.get('1215031022')).toMatchObject({
      name: '신대리',
      emdName: '해룡면 신대리',
      parentName: '해룡면',
    });
    expect(index.get('12150310')?.emdName).toBe('해룡면');
  });

  it('prefers the 8-digit row when both spellings exist', () => {
    const index = regionInfoIndex([
      region('12150114', '연향동', 'EMD', '12150'),
      region('1215011400', '연향동(구)', 'EMD', '12150'),
    ]);
    expect(index.get('12150114')?.name).toBe('연향동');
  });
});

describe('resolveRegionInfo (never a raw code as the name)', () => {
  const index = regionInfoIndex([
    region('12150114', '연향동', 'EMD', '12150'),
    region('12150310', '해룡면', 'EMD', '12150'),
  ]);

  it('uses the regions row when there is one', () => {
    expect(resolveRegionInfo('12150114', index)?.name).toBe('연향동');
  });

  it('falls back to the bundled verified list for a code without a row', () => {
    // the live bug: a 조례동 listing (12150133) while the table still held sample rows
    expect(resolveRegionInfo('12150133', index)).toMatchObject({
      name: '조례동',
      emdName: '조례동',
      parentName: null,
    });
    expect(resolveRegionInfo('1215031022', index)).toMatchObject({
      name: '신대리',
      emdName: '해룡면 신대리',
      parentName: '해룡면',
    });
  });

  it('names an unknown 리 after its 읍면 (table first, then the list)', () => {
    expect(resolveRegionInfo('1215031099', index)?.name).toBe('해룡면');
    expect(resolveRegionInfo('1215035099', index)?.name).toBe('주암면');
  });

  it('is null when nothing names the code', () => {
    expect(resolveRegionInfo('12150999', index)).toBeNull();
    expect(resolveRegionInfo('1219010199', index)).toBeNull();
  });
});
