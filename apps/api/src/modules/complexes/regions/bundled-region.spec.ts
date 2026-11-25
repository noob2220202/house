import { bundledRegionLabel } from './bundled-region';

describe('bundledRegionLabel (name fallback from the verified list)', () => {
  it('names 읍면동 codes in every spelling', () => {
    for (const code of ['12150133', '1215013300', '46150133', '4615013300']) {
      expect(bundledRegionLabel(code)).toMatchObject({
        code: '12150133',
        name: '조례동',
        emdName: '조례동',
        parentName: null,
      });
    }
  });

  it('names a 리 with its 읍면 and falls back to the 읍면 for an unknown 리', () => {
    expect(bundledRegionLabel('1215031022')).toMatchObject({
      code: '1215031022',
      name: '신대리',
      emdName: '해룡면 신대리',
      parentName: '해룡면',
    });
    expect(bundledRegionLabel('1215035027')).toMatchObject({ code: '12150350', name: '주암면' });
  });

  it('is null for codes it cannot name (never echoes the code)', () => {
    expect(bundledRegionLabel('12150999')).toBeNull();
    expect(bundledRegionLabel('1219010100')).toBeNull(); // another 시군구
    expect(bundledRegionLabel('12150')).toBeNull();
    expect(bundledRegionLabel(null)).toBeNull();
    expect(bundledRegionLabel('')).toBeNull();
  });
});
