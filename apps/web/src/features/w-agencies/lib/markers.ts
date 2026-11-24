import type { ClusterMarker, ComplexMarker, MapMarker, PinMarker } from '@/lib/map/types';
import type { AgencySummary } from '../api/schemas';
import { shortAgencyName } from './agency';
import { formatCount } from '@/lib/format';

export const CLUSTER_ID_PREFIX = 'cluster:';
/** Offices in one grid cell needed to merge them into a bubble. */
export const CLUSTER_MIN = 3;
/** From this zoom on every office is shown individually. */
export const CLUSTER_MAX_ZOOM = 15.5;
/**
 * Clusters with a member closer than this many cells to the selected office are dissolved, so no
 * bubble overlaps the selected office's label.
 */
export const SELECTED_CLEARANCE = 1;

/** Grid cell width in degrees of longitude (≈1.1 km at zoom 13, halves per zoom level). */
export function clusterCellDeg(zoom: number): number {
  return 0.012 * 2 ** (13 - zoom);
}

export interface AgencyMarkerOptions {
  zoom: number;
  selectedId?: string | null;
  /** How many unclustered offices get a name label (the rest are count pins). Default 5. */
  maxLabels?: number;
}

type Office = Pick<
  AgencySummary,
  'id' | 'name' | 'lat' | 'lng' | 'emdName' | 'activeListingCount' | 'specialties'
>;

function majority(values: readonly (string | null | undefined)[]): string | undefined {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: string | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Labelled office marker. The shared marker set has no office kind yet (design `.mk--office`:
 * store-icon badge + name + "매물 46"), so the complex marker is used with the design's sub-label
 * "매물 {count}" — it reads as an office with N listings, not as a complex/price marker.
 */
function labelMarker(a: Office): ComplexMarker {
  return {
    kind: 'complex',
    id: a.id,
    position: { lat: a.lat, lng: a.lng },
    name: shortAgencyName(a.name),
    count: a.activeListingCount,
    areaLabel: '매물',
    priceLabel: formatCount(a.activeListingCount),
    ariaLabel: `${a.name}, 보유 매물 ${a.activeListingCount}건`,
  };
}

function pinMarker(a: Office): PinMarker {
  return {
    kind: 'pin',
    id: a.id,
    position: { lat: a.lat, lng: a.lng },
    count: a.activeListingCount,
    ariaLabel: `${a.name}, 보유 매물 ${a.activeListingCount}건`,
  };
}

/**
 * Office markers for the map: dense areas collapse into "동 이름 + N곳" bubbles (grid clustering in
 * geographic space, so it behaves the same on the Naver and the static map), the offices with the
 * most listings get a name label, the rest are small count pins. The selected office is always
 * shown on its own with a label. Returned in paint order (clusters → pins → labels → selected).
 */
export function buildAgencyMarkers(
  agencies: readonly Office[],
  { zoom, selectedId, maxLabels = 5 }: AgencyMarkerOptions,
): MapMarker[] {
  const selected = selectedId ? agencies.find((a) => a.id === selectedId) : undefined;
  const rest = agencies.filter((a) => a.id !== selectedId);

  const clusters: ClusterMarker[] = [];
  let singles: Office[] = rest;

  if (zoom < CLUSTER_MAX_ZOOM) {
    const cellLng = clusterCellDeg(zoom);
    const cellLat = cellLng * 0.82; // cos(35°): keep cells roughly square on screen
    const cells = new Map<string, Office[]>();
    for (const a of rest) {
      const key = `${Math.floor(a.lng / cellLng)}:${Math.floor(a.lat / cellLat)}`;
      const bucket = cells.get(key);
      if (bucket) bucket.push(a);
      else cells.set(key, [a]);
    }
    singles = [];
    for (const [key, members] of cells) {
      // A bubble right next to the selected office would paint over its label: near the
      // selection the offices are shown one by one instead.
      const nearSelected =
        !!selected &&
        members.some(
          (m) =>
            Math.abs(m.lng - selected.lng) < cellLng * SELECTED_CLEARANCE &&
            Math.abs(m.lat - selected.lat) < cellLat * SELECTED_CLEARANCE,
        );
      if (members.length < CLUSTER_MIN || nearSelected) {
        singles.push(...members);
        continue;
      }
      const name = majority(members.map((m) => m.emdName));
      clusters.push({
        kind: 'cluster',
        id: `${CLUSTER_ID_PREFIX}${key}`,
        position: {
          lat: members.reduce((sum, m) => sum + m.lat, 0) / members.length,
          lng: members.reduce((sum, m) => sum + m.lng, 0) / members.length,
        },
        name,
        count: members.length,
        size: 'sm',
        ariaLabel: `${name ?? '이 지역'} 중개사무소 ${members.length}곳, 확대해서 보기`,
      });
    }
  }

  const ranked = [...singles].sort(
    (a, b) => b.activeListingCount - a.activeListingCount || a.name.localeCompare(b.name, 'ko'),
  );
  const labelled = ranked.slice(0, Math.max(0, maxLabels));
  const pins = ranked.slice(Math.max(0, maxLabels));

  return [
    ...clusters,
    ...pins.map(pinMarker),
    // Reverse so the office with the most listings paints last (on top).
    ...labelled.reverse().map(labelMarker),
    ...(selected ? [labelMarker(selected)] : []),
  ];
}

export const isClusterId = (id: string): boolean => id.startsWith(CLUSTER_ID_PREFIX);
