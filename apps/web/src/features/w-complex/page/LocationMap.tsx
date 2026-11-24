'use client';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { MapView } from '@/components/map';
import { ROUTES } from '@/config/nav';
import { formatPriceShort } from '@/lib/format';
import type { ComplexDetail, NearbyComplex } from '../api/schemas';
import { complexMarkers } from '../lib/markers';

export interface LocationMapProps {
  complex: Pick<ComplexDetail, 'id' | 'name' | 'lat' | 'lng' | 'activeListingCount'>;
  nearby: readonly NearbyComplex[];
}

/** Static mini map: the complex (selected) and its neighbours; a neighbour marker opens its page. */
export function LocationMap({ complex, nearby }: LocationMapProps) {
  const router = useRouter();
  const center = useMemo(
    () => ({ lat: complex.lat, lng: complex.lng }),
    [complex.lat, complex.lng],
  );
  const markers = useMemo(
    () => complexMarkers(complex, nearby, formatPriceShort),
    [complex, nearby],
  );
  return (
    <MapView
      center={center}
      zoom={15}
      markers={markers}
      selectedId={complex.id}
      interactive={false}
      ariaLabel={`${complex.name} 위치 지도`}
      onMarkerClick={(m) => {
        if (m.id !== complex.id) router.push(ROUTES.complex(m.id));
      }}
    />
  );
}
