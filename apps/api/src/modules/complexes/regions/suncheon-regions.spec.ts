import {
  canonicalRegionCode,
  DEFAULT_SGG_CODE,
  legacyRegionCode,
  normalizeRegionCode,
  REGION_CODE_PATTERN,
} from '@house/shared';
import {
  findSuncheonRegion,
  SUNCHEON_REGIONS,
  SUNCHEON_SGG,
  SUNCHEON_SGG_CODE,
  SUNCHEON_SIDO,
  suncheonRegionFullName,
} from './suncheon-regions.data';
import { SERVICE_REGION_RADIUS_M } from '../../listings/constants';

const distanceM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
};

describe('순천시 법정동 data (verified 2026-11-25)', () => {
  const codes = SUNCHEON_REGIONS.map((r) => r.code);
  const emd = SUNCHEON_REGIONS.filter((r) => r.level === 'EMD');
  const ri = SUNCHEON_REGIONS.filter((r) => r.level === 'RI');

  it('has 33 동 + 1 읍 + 10 면 + 163 리, all under 12150, unique, already normalized', () => {
    expect(SUNCHEON_REGIONS).toHaveLength(207);
    expect(emd).toHaveLength(44);
    expect(emd.filter((r) => r.name.endsWith('동'))).toHaveLength(33);
    expect(emd.filter((r) => r.name.endsWith('읍'))).toHaveLength(1);
    expect(emd.filter((r) => r.name.endsWith('면'))).toHaveLength(10);
    expect(ri).toHaveLength(163);
    expect(new Set(codes).size).toBe(codes.length);
    for (const r of SUNCHEON_REGIONS) {
      expect(r.code.startsWith(SUNCHEON_SGG_CODE)).toBe(true);
      expect(REGION_CODE_PATTERN.test(r.code)).toBe(true);
      expect(r.code).toHaveLength(r.level === 'EMD' ? 8 : 10);
      expect(normalizeRegionCode(r.code)).toBe(r.code);
      // Within the listing service radius of the city centre (listings constants).
      expect(distanceM(r, SUNCHEON_SGG)).toBeLessThan(SERVICE_REGION_RADIUS_M);
    }
  });

  it('lists every 리 after its 읍면 parent; 읍면동 hang off the 시군구', () => {
    const seen = new Set<string>();
    for (const r of SUNCHEON_REGIONS) {
      if (r.level === 'RI') {
        expect(r.parentCode).toBe(r.code.slice(0, 8));
        expect(seen.has(r.parentCode)).toBe(true);
      } else {
        expect(r.parentCode).toBe(SUNCHEON_SGG_CODE);
      }
      seen.add(r.code);
    }
  });

  it('carries the official codes (not the old sample seed numbers)', () => {
    const byName = (n: string) => findSuncheonRegion(n)?.code;
    expect(byName('조례동')).toBe('12150133');
    expect(byName('장천동')).toBe('12150119');
    expect(byName('왕지동')).toBe('12150132');
    expect(byName('해룡면')).toBe('12150310');
    expect(byName('주암면')).toBe('12150350');
    expect(byName('상사면')).toBe('12150400');
    expect(byName('신대리')).toBe('1215031022');
    expect(byName('해룡면 선월리')).toBe('1215031028');
    expect(byName('복성리')).toBe('1215031021');
    expect(codes).not.toContain('1215035027'); // gap in the official 주암면 numbering
  });

  it('finds 리 by 읍면 + 리 and refuses ambiguous names', () => {
    expect(findSuncheonRegion('신성리')).toBeUndefined();
    expect(findSuncheonRegion('승주읍 신성리')?.code).toBe('1215025030');
    expect(findSuncheonRegion('해룡면 신성리')?.code).toBe('1215031029');
    expect(findSuncheonRegion('없는동')).toBeUndefined();
  });

  it('builds full names with the 읍면 of a 리', () => {
    expect(suncheonRegionFullName(findSuncheonRegion('조례동')!)).toBe(
      '전남광주통합특별시 순천시 조례동',
    );
    expect(suncheonRegionFullName(findSuncheonRegion('신대리')!)).toBe(
      '전남광주통합특별시 순천시 해룡면 신대리',
    );
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
