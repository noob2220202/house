// Owned by the deal-requests module team. What an agency sees of a 내놓기 request before the
// requester shares contact + details with it (DealRequestContactGrant) — the 제공 항목 of the
// DEAL_REQUEST_PROVIDE notice. The API applies these; the frontends only render the result.

/**
 * Grid of the approximate position: lat/lng are snapped to the centre of a 0.002° cell (about
 * 220 m north–south and 180 m east–west in 순천), so the point shows the neighbourhood, never the
 * building.
 */
export const DEAL_REQUEST_LOCATION_GRID_DEG = 0.002;

/** Lower bounds (㎡, 전용) of the area bands shown instead of the exact area before a grant. */
export const DEAL_REQUEST_AREA_BANDS: readonly number[] = [
  0, 20, 40, 60, 85, 102, 135, 165, 200, 330, 660, 1000, 3300,
];

export interface DealRequestAreaRange {
  /** ㎡, inclusive. */
  min: number;
  /** ㎡, exclusive; null = open-ended (the last band). */
  max: number | null;
}

/** Centre of the grid cell holding the point (4 decimals). */
export function coarseDealRequestPoint(
  lat: number | null,
  lng: number | null,
): { lat: number | null; lng: number | null } {
  if (lat === null || lng === null) return { lat: null, lng: null };
  const g = DEAL_REQUEST_LOCATION_GRID_DEG;
  const snap = (v: number) => Math.round((Math.floor(v / g) * g + g / 2) * 10_000) / 10_000;
  return { lat: snap(lat), lng: snap(lng) };
}

/** The band an exact area falls in ("60–85㎡"), or null without an area. */
export function dealRequestAreaRange(area: number | null): DealRequestAreaRange | null {
  if (area === null || !Number.isFinite(area) || area <= 0) return null;
  const bands = DEAL_REQUEST_AREA_BANDS;
  let i = bands.length - 1;
  while (i > 0 && area < bands[i]!) i -= 1;
  return { min: bands[i]!, max: i + 1 < bands.length ? bands[i + 1]! : null };
}

/**
 * Lines of a 내놓기 description that the request form writes from checkboxes (see the web
 * `composeDescription`): not free text, so they may reach agencies before a grant.
 */
const PUBLIC_FLAG_LINES = new Set(['· 가격 협의 가능', '· 즉시 입주 가능', '· 입주일 협의 가능']);
const PUBLIC_FLOOR_CLASS_LINE = /^· (저층|중층|고층) \(총 \d{1,3}층\)$/;

export function isPublicDealRequestFlag(line: string): boolean {
  const t = line.trim();
  return PUBLIC_FLAG_LINES.has(t) || PUBLIC_FLOOR_CLASS_LINE.test(t);
}

/**
 * The part of a 내놓기 description an agency may see before a grant: only the form's flag lines
 * (가격 협의 가능, 즉시 입주 가능, 저/중/고층 …), never the requester's own words. Null if none.
 */
export function publicDealRequestDescription(description: string | null): string | null {
  if (!description) return null;
  const flags = description
    .split('\n')
    .map((l) => l.trim())
    .filter(isPublicDealRequestFlag);
  return flags.length > 0 ? flags.join('\n') : null;
}
