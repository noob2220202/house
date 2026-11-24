import { DealType } from '@house/shared';
import { formatAreaPair, type AreaUnit } from '@/lib/format';
import type { LatLng, MapBounds, MapMarker } from '@/lib/map';
import type { MapComplexMarker, MapListingMarker, MapSearchResponse } from '../api/schemas';
import {
  dealKind,
  dealPriceOf,
  formatMarkerPrice,
  markerPriceText,
  priceTextLabeled,
} from './listing';

export interface MarkerOptions {
  unit: AreaUnit;
  /** Mobile: unselected complex markers show only count + price. */
  compact?: boolean;
  selectedId?: string | null;
  /** 실거래가 layer: print the latest trade instead of the asking price. */
  tradeLayer?: boolean;
  /** Name prefix to drop from complex names ("신대" → "레이크파크 1단지"). */
  localPrefix?: string | null;
  /** Price pills already merged with `groupListingMarkers` (omit to draw one pill per building). */
  groups?: readonly ListingGroup[];
}

/** "신대 레이크파크 1단지" → "레이크파크 1단지" while browsing 신대지구. */
export function shortComplexName(name: string, localPrefix?: string | null): string {
  if (!localPrefix) return name;
  const rest = name.startsWith(`${localPrefix} `) ? name.slice(localPrefix.length + 1) : name;
  return rest.length >= 2 ? rest : name;
}

const DEAL_NOTE: Partial<Record<DealType, string>> = {
  PRESALE: '분양권',
  JEONSE: '전세',
  MONTHLY: '월세',
};

function complexMarker(m: MapComplexMarker, o: MarkerOptions): MapMarker {
  const rep = m.representative;
  const trade = o.tradeLayer ? m.latestTrade : null;
  const pyeong = trade?.pyeongLabel ?? rep?.pyeongLabel;
  // ㎡ with 평 alongside (계량법); a 실거래 carries only its 평형 name, so it keeps that label.
  const supply = !trade ? rep?.supplyArea : null;
  const areaLabel = supply ? formatAreaPair(supply, o.unit) : pyeong ? `${pyeong}평` : undefined;
  const price = trade?.price ?? rep?.price;
  const priceLabel = price === null || price === undefined ? undefined : formatMarkerPrice(price);
  const dealNote = trade ? '실거래' : rep ? DEAL_NOTE[rep.dealType] : undefined;
  const presale = m.counts.presale > 0 && m.counts.presale >= m.count / 2;
  const full = !o.compact || m.id === o.selectedId;
  const lead = [areaLabel, dealNote].filter(Boolean).join(' ');
  return {
    kind: 'complex',
    id: m.id,
    position: { lat: m.lat, lng: m.lng },
    name: full ? shortComplexName(m.name, o.localPrefix) : '',
    count: m.count,
    areaLabel: full ? areaLabel : undefined,
    dealNote: full ? dealNote : undefined,
    priceLabel,
    presale,
    ariaLabel: `${m.name}, 매물 ${m.count}건${priceLabel ? `, ${lead} ${priceLabel}` : ''}`,
  };
}

// ---- price pills: merge neighbours that would overlap --------------------------------------------

/** Screen px per degree at the current zoom (`W / lngSpan`, `H / latSpan`). */
export interface PxPerDeg {
  lng: number;
  lat: number;
}

/**
 * Two price pills closer than this (px between their anchor points) cannot both be read — a pill is
 * about 95 × 28px — so they are drawn as one ("500/38 +4").
 */
export const DECLUTTER_PX = { x: 72, y: 28 } as const;

/** One pill on the map: a building, or several neighbouring buildings merged at this zoom. */
export interface ListingGroup {
  /** Cheapest marker of the group: its id is the pill id, its point the pill position. */
  rep: MapListingMarker;
  members: readonly MapListingMarker[];
  /** Listings behind the pill (sum of the members' counts). */
  count: number;
  /** Box around every member (±2 m) — `GET /listings?bbox` returns exactly the group's listings. */
  area: MapBounds;
}

/** ≈ 2 m: one building. */
const POINT_PAD_DEG = 0.00002;

export function pointArea(p: LatLng): MapBounds {
  return {
    swLat: p.lat - POINT_PAD_DEG,
    swLng: p.lng - POINT_PAD_DEG,
    neLat: p.lat + POINT_PAD_DEG,
    neLng: p.lng + POINT_PAD_DEG,
  };
}

/** One amount to rank markers by (월세: 1만원/월 ≈ 보증금 100만원). Unknown prices sort last. */
function rankPrice(m: MapListingMarker): number {
  const p = dealPriceOf(m);
  if (p.dealType === DealType.MONTHLY) {
    return p.monthlyRent === null || p.monthlyRent === undefined
      ? Infinity
      : (p.deposit ?? 0) + p.monthlyRent * 100;
  }
  return p.price ?? Infinity;
}

/**
 * Merges price markers that would overlap on screen. Greedy from the cheapest: each marker joins the
 * first group whose representative is within `DECLUTTER_PX`, otherwise starts its own group — so a
 * group's pill always shows its cheapest listing and no two pills stand closer than the threshold.
 * Depends only on the scale (not on the map position), so pills do not regroup while panning.
 */
export function groupListingMarkers(
  markers: readonly MapListingMarker[],
  pxPerDeg: PxPerDeg | null,
  threshold: { x: number; y: number } = DECLUTTER_PX,
): ListingGroup[] {
  const sorted = [...markers].sort(
    (a, b) => rankPrice(a) - rankPrice(b) || b.count - a.count || a.id.localeCompare(b.id),
  );
  const groups: { rep: MapListingMarker; members: MapListingMarker[] }[] = [];
  for (const m of sorted) {
    const home = pxPerDeg
      ? groups.find(
          (g) =>
            Math.abs(g.rep.lng - m.lng) * pxPerDeg.lng < threshold.x &&
            Math.abs(g.rep.lat - m.lat) * pxPerDeg.lat < threshold.y,
        )
      : undefined;
    if (home) home.members.push(m);
    else groups.push({ rep: m, members: [m] });
  }
  return groups.map(({ rep, members }) => {
    const lats = members.map((m) => m.lat);
    const lngs = members.map((m) => m.lng);
    return {
      rep,
      members,
      count: members.reduce((n, m) => n + m.count, 0),
      area: {
        swLat: Math.min(...lats) - POINT_PAD_DEG,
        swLng: Math.min(...lngs) - POINT_PAD_DEG,
        neLat: Math.max(...lats) + POINT_PAD_DEG,
        neLng: Math.max(...lngs) + POINT_PAD_DEG,
      },
    };
  });
}

function groupMarker({ rep, count }: ListingGroup): MapMarker {
  const more = count > 1 ? ` +${count - 1}` : '';
  return {
    kind: 'price',
    id: rep.id,
    position: { lat: rep.lat, lng: rep.lng },
    deal: dealKind(rep),
    priceLabel: `${markerPriceText(rep)}${more}`,
    ariaLabel: `${rep.title ? `${rep.title} ` : ''}${priceTextLabeled(rep)}${count > 1 ? ` 외 ${count - 1}개` : ''}`,
  };
}

/** `GET /map/search` response → marker models of the MapView abstraction. */
export function toMapMarkers(res: MapSearchResponse | undefined, o: MarkerOptions): MapMarker[] {
  if (!res) return [];
  const max = Math.max(1, ...res.clusters.map((c) => c.count));
  const groups =
    o.groups ??
    groupListingMarkers(
      res.markers.filter((m) => m.type === 'LISTING'),
      null,
    );
  return [
    ...res.clusters.map(
      (c): MapMarker => ({
        kind: 'cluster',
        id: c.id,
        position: { lat: c.lat, lng: c.lng },
        name: c.name ?? undefined,
        count: c.count,
        // Smaller bubble for the lighter half so dense areas read first.
        size: c.count < max / 2 ? 'sm' : 'md',
      }),
    ),
    ...res.markers.flatMap((m) => (m.type === 'COMPLEX' ? [complexMarker(m, o)] : [])),
    ...groups.map(groupMarker),
  ];
}
