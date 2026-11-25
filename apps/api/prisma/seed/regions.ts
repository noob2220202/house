/**
 * 순천시 법정동 list for the seeds: the verified bundled list of the API
 * (src/modules/complexes/regions/suncheon-regions.data.ts — 33 동, 1 읍, 10 면, 163 리; 읍면동
 * codes 8 digits, 리 10). The base seed loads all of it; the demo seed names its places with
 * {@link regionByName}.
 */
import {
  findSuncheonRegion,
  SUNCHEON_REGIONS,
  SUNCHEON_SGG_CODE,
  suncheonRegionFullName,
  type SuncheonRegion,
} from '../../src/modules/complexes/regions/suncheon-regions.data';

export { SUNCHEON_REGIONS, suncheonRegionFullName, type SuncheonRegion };

/** 시군구 the list belongs to (전남광주통합특별시 순천시; 전라남도 순천시 46150 until 2026-06-30). */
export const SEED_SGG_CODE = SUNCHEON_SGG_CODE;

/**
 * The region called `name` ("조례동", "해룡면 신대리", or a 리 name that is unique in the city).
 * Throws for an unknown or ambiguous name, so demo data can never point at the wrong 법정동.
 */
export function regionByName(name: string): SuncheonRegion {
  const r = findSuncheonRegion(name);
  if (!r) throw new Error(`unknown or ambiguous seed region "${name}"`);
  return r;
}
