import type { RegionView } from '@house/shared';
import {
  bundledRegionLabel,
  type BundledRegionLabel,
} from '../../complexes/regions/bundled-region';

/** How a 지역 (8-digit 읍면동 / 10-digit 리 key) is shown on the home page. */
export interface RegionInfo {
  /** "연향동" / "신대리" */
  name: string;
  /** 법정동 label: the 읍면동 name, or "읍면 리" for a 리 ("해룡면 신대리"). */
  emdName: string;
  /** Parent 읍·면 of a 리 (null for 읍면동). */
  parentName: string | null;
  lat: number | null;
  lng: number | null;
}

/**
 * Indexes the service region's 읍면동 / 리 rows by region key. 읍면동 rows may be stored with 8
 * digits (행안부 list) or 10 digits ending in 00 (Kakao bcode); both map to the 8-digit key.
 */
export function regionInfoIndex(regions: readonly RegionView[]): Map<string, RegionInfo> {
  const byCode = new Map(regions.map((r) => [r.code, r]));
  const out = new Map<string, RegionInfo>();
  for (const r of regions) {
    const key = r.code.length === 10 && r.code.endsWith('00') ? r.code.slice(0, 8) : r.code;
    if (out.has(key) && key !== r.code) continue; // the 8-digit row wins
    const parent = r.level === 'RI' && r.parentCode ? byCode.get(r.parentCode) : undefined;
    out.set(key, {
      name: r.name,
      emdName: parent ? `${parent.name} ${r.name}` : r.name,
      parentName: parent?.name ?? null,
      lat: r.lat,
      lng: r.lng,
    });
  }
  return out;
}

/**
 * Display info of region key `key` (8-digit 읍면동 / 10-digit 리), never the raw code: the
 * regions row, else the bundled verified 순천시 list, else — for a 리 — its 읍·면 (from the table,
 * then the list). Null when nothing names it; the caller then leaves the region out.
 */
export function resolveRegionInfo(
  key: string,
  index: ReadonlyMap<string, RegionInfo>,
): RegionInfo | null {
  const own = index.get(key);
  if (own) return own;
  const bundled = bundledRegionLabel(key);
  if (bundled?.code === key) return bundledInfo(bundled);
  if (key.length === 10) {
    const parent = index.get(key.slice(0, 8));
    if (parent) return parent;
  }
  return bundled ? bundledInfo(bundled) : null;
}

function bundledInfo(b: BundledRegionLabel): RegionInfo {
  return { name: b.name, emdName: b.emdName, parentName: b.parentName, lat: b.lat, lng: b.lng };
}
