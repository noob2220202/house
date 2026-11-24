import type { DealType } from '@house/shared';
import { ROUTES } from '@/config/nav';
import { buildMapHref } from '@/lib/map/url-state';
import { COMPLEX_PARAM } from './filters';

/** Zoom at which a single complex and its neighbours are visible. */
export const COMPLEX_MAP_ZOOM = 16;

/**
 * Map URL that opens a complex's listing panel: `/map/apt?c=<lat,lng>&z=16&sel=<id>&list=1&complex=<id>`.
 *
 * - `complex` selects the complex for the w-complex panel (`ComplexPanelSlot`),
 * - `c` / `z` centre the map on it and `sel` + `list=1` are the map page's own "selected complex,
 *   list open" state, so the link also lands on the right place before the panel slot is mounted.
 * - `deal` pre-filters the panel (`c-deal`) and, until the panel is mounted on the map page, the map
 *   page's own list through its deal filter (`dealTypes`), so the link never promises a filter that
 *   the landing page ignores.
 */
export function complexMapHref(
  complex: { id: string; lat: number; lng: number },
  deal?: DealType,
): string {
  const base = buildMapHref(ROUTES.map('apt'), {
    view: { center: { lat: complex.lat, lng: complex.lng }, zoom: COMPLEX_MAP_ZOOM },
    selected: complex.id,
  });
  const sp = new URLSearchParams({ list: '1', [COMPLEX_PARAM]: complex.id });
  if (deal) {
    sp.set('c-deal', deal);
    sp.set('dealTypes', deal);
  }
  return `${base}&${sp.toString()}`;
}
