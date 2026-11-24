import { HERO_MAP_BOUNDS, HERO_REGION_ANCHORS } from '../config';
import type { HomeRegion } from '../api/schemas';

export interface HeroRegionChip {
  code: string;
  name: string;
  count: number;
  /** % of the hero map frame. */
  x: number;
  y: number;
  /** Hidden below the desktop layout to keep the small map readable. */
  wideOnly: boolean;
  avgPricePerPyeong: number | null;
  lat: number;
  lng: number;
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Linear projection onto the hero frame for districts without a design anchor. */
export function projectToHero(lat: number, lng: number): { x: number; y: number } {
  const b = HERO_MAP_BOUNDS;
  return {
    x: clamp(((lng - b.swLng) / (b.neLng - b.swLng)) * 100, 10, 90),
    y: clamp(((b.neLat - lat) / (b.neLat - b.swLat)) * 100, 22, 92),
  };
}

/**
 * Places district chips on the hero map: design anchors first, projection otherwise. Chips that
 * would sit on top of an already placed one are dropped (most listings win), and at most `max` are
 * shown.
 */
export function heroRegionChips(regions: readonly HomeRegion[], max = 8): HeroRegionChip[] {
  const sorted = [...regions].sort((a, b) => b.listingCount - a.listingCount);
  const placed: HeroRegionChip[] = [];
  for (const r of sorted) {
    if (placed.length >= max) break;
    const anchor = HERO_REGION_ANCHORS[r.name];
    const pos = anchor ?? projectToHero(r.lat, r.lng);
    const collides = placed.some((p) => Math.abs(p.x - pos.x) < 20 && Math.abs(p.y - pos.y) < 9);
    if (collides) continue;
    placed.push({
      code: r.code,
      name: r.name,
      count: r.listingCount,
      x: pos.x,
      y: pos.y,
      wideOnly: anchor ? !!anchor.wide : placed.length >= 5,
      avgPricePerPyeong: r.avgPricePerPyeong ?? null,
      lat: r.lat,
      lng: r.lng,
    });
  }
  return placed;
}

/** The district to highlight: the one the featured listing is in, else the busiest one. */
export function highlightedRegion(
  chips: readonly HeroRegionChip[],
  regions: readonly HomeRegion[],
  featuredEmdName?: string | null,
): string | null {
  if (featuredEmdName) {
    const match = regions.find((r) => r.emdName === featuredEmdName || r.name === featuredEmdName);
    if (match && chips.some((c) => c.code === match.code)) return match.code;
  }
  return chips[0]?.code ?? null;
}
