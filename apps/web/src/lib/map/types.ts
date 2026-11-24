import type { DealKind } from '@house/ui';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Visible map area. Serialize for the API with `boundsToBboxParam` → "swLng,swLat,neLng,neLat". */
export interface MapBounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface MapViewState {
  center: LatLng;
  zoom: number;
}

interface MarkerBase {
  /** Stable id (cluster key, complex id, listing id). */
  id: string;
  position: LatLng;
  /** Optional accessible label override. */
  ariaLabel?: string;
}

/** District / grid cluster bubble (zoomed out): name + count. */
export interface ClusterMarker extends MarkerBase {
  kind: 'cluster';
  name?: string;
  count: number;
  /** White "outer area" variant. */
  outer?: boolean;
  size?: 'sm' | 'md';
}

/** Complex marker: count badge + name + 평형·price. */
export interface ComplexMarker extends MarkerBase {
  kind: 'complex';
  name: string;
  count: number;
  /** "34평" */
  areaLabel?: string;
  /** "4.4억" (use formatPriceShort) */
  priceLabel?: string;
  /** Extra word between area and price: "분양권". */
  dealNote?: string;
  /** Presale-heavy complex → purple count badge. */
  presale?: boolean;
}

/** Single-listing price pill (원룸·토지…): coloured dot + price. */
export interface PriceMarker extends MarkerBase {
  kind: 'price';
  deal: DealKind;
  /** "500/42", "1.2억" */
  priceLabel: string;
}

/** Count-only pin (mobile / dense zoom). */
export interface PinMarker extends MarkerBase {
  kind: 'pin';
  count: number;
}

export type MapMarker = ClusterMarker | ComplexMarker | PriceMarker | PinMarker;

export interface MapViewChange extends MapViewState {
  bounds: MapBounds;
}
