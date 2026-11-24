import type { DealType } from '@house/shared';
import { ROUTES, type MapAssetSlug } from '@/config/nav';
import { MAP_PARAM } from '@/lib/map/url-state';
import { COMPLEX_ZOOM, REGION_ZOOM } from '../config';

export interface MapLinkOptions {
  center?: { lat: number; lng: number } | null;
  zoom?: number;
  /** Deal-type filter (`deal=SALE`); `all` / undefined = no filter. */
  deal?: DealType | 'all' | null;
  /** Opens the complex panel on the map (`complex=<id>`, see w-complex). */
  complexId?: string | null;
}

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/**
 * Link into the map search with shareable URL state (`c=lat,lng&z=zoom`, see `@/lib/map`).
 * Filter params follow the map group's convention: `deal` (CSV of DealType).
 */
export function mapHref(asset: MapAssetSlug, options: MapLinkOptions = {}): string {
  const sp = new URLSearchParams();
  const { center, deal, complexId } = options;
  if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng)) {
    sp.set(MAP_PARAM.center, `${round(center.lat)},${round(center.lng)}`);
    sp.set(MAP_PARAM.zoom, String(options.zoom ?? (complexId ? COMPLEX_ZOOM : REGION_ZOOM)));
  }
  if (deal && deal !== 'all') sp.set('deal', deal);
  if (complexId) sp.set('complex', complexId);
  const qs = sp.toString();
  return qs ? `${ROUTES.map(asset)}?${qs}` : ROUTES.map(asset);
}

/** Unified search results page, keeping the hero's deal pill. */
export function searchHref(q: string, deal?: DealType | 'all' | null): string {
  const base = ROUTES.search(q.trim());
  return deal && deal !== 'all' ? `${base}&deal=${deal}` : base;
}

/** Click-through URL of a banner (the shared ads client). */
export { bannerClickHref } from '@/lib/ads/links';
