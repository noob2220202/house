import { REGION_CODE_PATTERN } from '@house/shared';
import { SUNCHEON_REGIONS, SUNCHEON_SGG_CODE } from './suncheon-regions.data';

describe('순천시 법정동 data', () => {
  const codes = SUNCHEON_REGIONS.map(([code]) => code);
  const emd = codes.filter((c) => c.length === 8);

  it('has 33 동 + 1 읍 + 10 면 and their 리, all under 46150, unique', () => {
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
    expect(SUNCHEON_REGIONS).toContainEqual(['46150133', '조례동']);
    expect(SUNCHEON_REGIONS).toContainEqual(['4615031022', '신대리']);
  });
});
