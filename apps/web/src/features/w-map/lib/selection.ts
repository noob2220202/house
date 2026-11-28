import type { LatLng, MapBounds, MapMarker } from '@/lib/map';
import type { ListingSummary } from '../api/schemas';
import { pointArea, type ListingGroup } from './markers';

export const samePoint = (a: LatLng, b: LatLng) => a.lat === b.lat && a.lng === b.lng;

/** What a selected price pill stands for: its point and the box that holds its listings. */
export type PickedPill = LatLng & { id: string; area: MapBounds; merged: boolean };

/**
 * The price pill a selection (`?sel=<listingId>`) stands for, in both list modes: the pill whose
 * members hold the id, else (a shared link to another room of the building) the pill at the point
 * of that listing in `knownListings` (the side list rows), else a pill-sized box at that point.
 * `null` when the id is no listing on screen (a complex id, or a listing outside the view).
 */
export function resolvePickedPill(
  selected: string | null,
  groups: readonly ListingGroup[],
  knownListings: readonly Pick<ListingSummary, 'id' | 'lat' | 'lng'>[],
): PickedPill | null {
  if (!selected) return null;
  const of = (g: ListingGroup): PickedPill => ({
    id: selected,
    lat: g.rep.lat,
    lng: g.rep.lng,
    area: g.area,
    merged: g.members.length > 1,
  });
  const group = groups.find((g) => g.members.some((m) => m.id === selected));
  if (group) return of(group);
  const item = knownListings.find((l) => l.id === selected);
  if (item?.lat == null || item.lng == null) return null;
  const point = { lat: item.lat, lng: item.lng };
  const around = groups.find((g) => g.members.some((m) => samePoint(m, point)));
  return around ? of(around) : { id: selected, ...point, area: pointArea(point), merged: false };
}

/**
 * The selected pill of the page. Listing mode: any selection. Complex mode (아파트·분양권): a price
 * pill is a listing without a 단지 and opens the same listing preview, located through the
 * "단지 정보 없는 매물" rows; a selected complex is never a pill.
 */
export function selectedPill(
  selected: string | null,
  ctx: {
    complexMode: boolean;
    complexSelected: boolean;
    groups: readonly ListingGroup[];
    listRows: readonly Pick<ListingSummary, 'id' | 'lat' | 'lng'>[];
    soloRows: readonly Pick<ListingSummary, 'id' | 'lat' | 'lng'>[];
  },
): PickedPill | null {
  if (ctx.complexMode && ctx.complexSelected) return null;
  return resolvePickedPill(selected, ctx.groups, ctx.complexMode ? ctx.soloRows : ctx.listRows);
}

/**
 * URL options of a marker click (`select(id, …)`). Only a complex marker in complex mode opens a
 * complex panel (mobile: at once; desktop: when one is open already — else the summary popover
 * first). A price pill never writes `?complex=` and closes an open complex panel.
 */
export function markerSelectOptions(
  kind: MapMarker['kind'],
  ctx: { complexMode: boolean; complexPanelOpen: boolean; isMobile: boolean },
): { complex: boolean; closeComplex: boolean } {
  const isComplex = ctx.complexMode && kind === 'complex';
  return {
    complex: isComplex && (ctx.isMobile || ctx.complexPanelOpen),
    closeComplex: !isComplex && ctx.complexPanelOpen,
  };
}

// ---- 단지 정보 없는 매물 (complex mode) -----------------------------------------------------------

/**
 * In complex mode (아파트·분양권) `GET /map/search` sends COMPLEX markers for listings of a 단지
 * and price pills only for listings without one (`complex_id IS NULL`, e.g. registered with
 * "직접 입력"). The panel section that lists them asks `GET /listings?withoutComplex=true&bbox=`
 * for the visible map, so it also works at the city zooms, where the map draws clusters instead
 * of pills. The client-side check stays as a guard for an API that ignores the filter.
 */
export const hasNoComplex = (l: Pick<ListingSummary, 'complexId'>) => !l.complexId;

/** Listings behind every price pill on screen (they match the filters, like the pills). */
export function standaloneCount(groups: readonly ListingGroup[]): number {
  return groups.reduce((n, g) => n + g.count, 0);
}

/**
 * "단지 정보 없는 매물 N건": the `total` of the viewport query once it answered; until then the
 * pills on screen (none below the marker zoom, where the section waits for the API).
 */
export function standaloneTotal(
  apiTotal: number | null | undefined,
  groups: readonly ListingGroup[],
): number {
  return apiTotal ?? standaloneCount(groups);
}
