import { normalizeRegionCode, REGION_CODE_LENGTH } from '@house/shared';
import { SUNCHEON_REGIONS, type SuncheonRegion } from './suncheon-regions.data';

/** How a 법정동 is labelled when the regions table has no row for its code. */
export interface BundledRegionLabel {
  /** Stored (normalized) code of the row the label comes from. */
  code: string;
  /** "조례동" / "신대리" */
  name: string;
  /** "조례동" / "해룡면 신대리" */
  emdName: string;
  /** 읍·면 of a 리, null for a 읍면동. */
  parentName: string | null;
  lat: number;
  lng: number;
}

const BY_CODE: ReadonlyMap<string, SuncheonRegion> = new Map(
  SUNCHEON_REGIONS.map((r) => [r.code, r]),
);

function labelOf(r: SuncheonRegion): BundledRegionLabel {
  const parent = r.level === 'RI' ? BY_CODE.get(r.parentCode) : undefined;
  return {
    code: r.code,
    name: r.name,
    emdName: parent ? `${parent.name} ${r.name}` : r.name,
    parentName: parent?.name ?? null,
    lat: r.lat,
    lng: r.lng,
  };
}

/**
 * Last-resort label of a 법정동 code from the bundled verified 순천시 list: the code itself (any
 * spelling: legacy 46150…, 10-digit 읍면동), else — for a 리 the list does not know — its 읍면.
 * Null when neither is known (another 시군구, a retired code): callers then omit the label
 * rather than show the raw code.
 */
export function bundledRegionLabel(code: string | null | undefined): BundledRegionLabel | null {
  if (!code) return null;
  const key = normalizeRegionCode(code);
  const own = BY_CODE.get(key);
  if (own) return labelOf(own);
  if (key.length === REGION_CODE_LENGTH.FULL) {
    const parent = BY_CODE.get(key.slice(0, REGION_CODE_LENGTH.EMD));
    if (parent) return labelOf(parent);
  }
  return null;
}
