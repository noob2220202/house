'use client';
import { useMemo } from 'react';
import { MapView } from '@/components/map';
import type { MapMarker } from '@/lib/map';
import { shortAgencyName } from '../lib/agency';

export interface AgencyLocationMapProps {
  id: string;
  name: string;
  lat: number;
  lng: number;
  listingCount: number;
}

/** Static (non-interactive) map preview centred on the office. The full map is one link away. */
export function AgencyLocationMap({ id, name, lat, lng, listingCount }: AgencyLocationMapProps) {
  const center = useMemo(() => ({ lat, lng }), [lat, lng]);
  const markers = useMemo<MapMarker[]>(
    () => [
      {
        kind: 'complex',
        id,
        position: { lat, lng },
        name: shortAgencyName(name),
        count: listingCount,
        ariaLabel: `${name} 위치`,
      },
    ],
    [id, name, lat, lng, listingCount],
  );
  return (
    <MapView
      center={center}
      zoom={14}
      markers={markers}
      selectedId={id}
      interactive={false}
      ariaLabel={`${name} 위치 지도`}
    />
  );
}
