import {
  canonicalRegionCode,
  DEFAULT_SGG_CODE,
  legacyRegionCode,
  REGION_CODE_PATTERN,
} from '@house/shared';
import {
  SUNCHEON_REGIONS,
  SUNCHEON_SGG,
  SUNCHEON_SGG_CODE,
  SUNCHEON_SIDO,
} from './suncheon-regions.data';

describe('순천시 법정동 data', () => {
  const codes = SUNCHEON_REGIONS.map(([code]) => code);
  const emd = codes.filter((c) => c.length === 8);

  it('has 33 동 + 1 읍 + 10 면 and their 리, all under 12150, unique', () => {
    expect(emd).toHaveLength(44);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code.startsWith(SUNCHEON_SGG_CODE)).toBe(true);
      expect(REGION_CODE_PATTERN.test(code)).toBe(true);
    }
  });

  it('lists every 리 after its 읍면 parent', () => {
    const seen = new Set<string>();
    for (const code of codes) {
      if (code.length === 10) expect(seen.has(code.slice(0, 8))).toBe(true);
      seen.add(code);
    }
    expect(SUNCHEON_REGIONS).toContainEqual(['12150133', '조례동']);
    expect(SUNCHEON_REGIONS).toContainEqual(['1215031022', '신대리']);
  });

  it('uses the 2026-07-01 codes (전남광주통합특별시) and maps every former 46150 code onto them', () => {
    expect(SUNCHEON_SGG_CODE).toBe(DEFAULT_SGG_CODE);
    expect(SUNCHEON_SIDO).toEqual({ code: '12', name: '전남광주통합특별시' });
    expect(SUNCHEON_SGG.fullName).toBe('전남광주통합특별시 순천시');
    for (const code of codes) {
      const legacy = legacyRegionCode(code);
      expect(legacy?.startsWith('46150')).toBe(true);
      expect(canonicalRegionCode(legacy ?? '')).toBe(code);
    }
  });
});
