import type { MapMarker } from '@/lib/map';
import type { ComplexDetail, NearbyComplex } from '../api/schemas';

/** "신대 레이크파크 1단지" → "레이크파크 1단지": markers drop a leading district word when the name is long. */
export function markerName(name: string): string {
  const [head, ...rest] = name.split(' ');
  return rest.length >= 2 && head && head.length <= 3 ? rest.join(' ') : name;
}

/** Map markers of a complex screen: the complex itself (selected) plus its neighbours. */
export function complexMarkers(
  complex: Pick<ComplexDetail, 'id' | 'name' | 'lat' | 'lng' | 'activeListingCount'>,
  nearby: readonly NearbyComplex[],
  formatPrice: (manwon: number) => string,
): MapMarker[] {
  const neighbours: MapMarker[] = nearby.map((n) => ({
    kind: 'complex',
    id: n.id,
    position: { lat: n.lat, lng: n.lng },
    name: markerName(n.name),
    count: n.activeListingCount,
    areaLabel: n.representative?.pyeongLabel ?? undefined,
    priceLabel:
      n.representative?.price !== null && n.representative?.price !== undefined
        ? formatPrice(n.representative.price)
        : undefined,
    dealNote: n.representative?.dealType === 'PRESALE' ? '분양권' : undefined,
    presale: n.dealCounts.presale > n.dealCounts.sale,
  }));
  return [
    ...neighbours,
    {
      kind: 'complex',
      id: complex.id,
      position: { lat: complex.lat, lng: complex.lng },
      name: markerName(complex.name),
      count: complex.activeListingCount,
    },
  ];
}
