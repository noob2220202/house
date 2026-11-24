'use client';
import { EmptyState, Icon } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { MapBreadcrumb, MapToolButton, MapView, MapZoomControl } from '@/components/map';
import { BRAND } from '@/config/brand';
import { formatPriceShort } from '@/lib/format';
import { MAP_ZOOM, clampZoom, type MapMarker } from '@/lib/map';
import { complexKeys, fetchComplex, fetchNearbyComplexes } from '../api/queries';
import type { ComplexDetail, NearbyComplex } from '../api/schemas';
import { useComplexParam } from '../hooks/usePanelFilters';
import { complexMarkers } from '../lib/markers';
import { ComplexPanelSlot } from './ComplexPanelSlot';
import styles from './screen.module.css';

const COMPLEX_ZOOM = 15;

function ComplexMap({
  complex,
  nearby,
  onSelect,
}: {
  complex: ComplexDetail;
  nearby: readonly NearbyComplex[];
  onSelect: (id: string) => void;
}) {
  const home = useMemo(() => ({ lat: complex.lat, lng: complex.lng }), [complex.lat, complex.lng]);
  const [view, setView] = useState({ center: home, zoom: COMPLEX_ZOOM });
  const markers = useMemo<MapMarker[]>(
    () => complexMarkers(complex, nearby, formatPriceShort),
    [complex, nearby],
  );
  return (
    <MapView
      center={view.center}
      zoom={view.zoom}
      markers={markers}
      selectedId={complex.id}
      ariaLabel={`${complex.name} 위치 지도`}
      onViewChange={(c) => setView({ center: c.center, zoom: c.zoom })}
      onMarkerClick={(m) => {
        if (m.kind === 'complex' && m.id !== complex.id) onSelect(m.id);
      }}
    >
      <div className={styles.mapTop}>
        <MapBreadcrumb
          items={[
            { label: BRAND.region, hasMenu: false },
            ...(complex.emdName ? [{ label: complex.emdName, hasMenu: false }] : []),
            {
              label: complex.name,
              hasMenu: false,
              onClick: () => setView({ center: home, zoom: COMPLEX_ZOOM }),
            },
          ]}
        />
      </div>
      <div className={styles.tools}>
        <MapZoomControl
          className="only-lg"
          onZoomIn={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom + 1) }))}
          onZoomOut={() => setView((v) => ({ ...v, zoom: clampZoom(v.zoom - 1) }))}
          canZoomIn={view.zoom < MAP_ZOOM.MAX}
          canZoomOut={view.zoom > MAP_ZOOM.MIN}
        />
        <MapToolButton
          label="단지 위치로 이동"
          onClick={() => setView({ center: home, zoom: COMPLEX_ZOOM })}
        >
          <Icon name="locate" size={22} />
        </MapToolButton>
      </div>
    </MapView>
  );
}

/**
 * Stand-alone composition of the Complex design: complex panel on the left, map with the complex and
 * its neighbours on the right. The production host of the panel is the map page
 * (`/map/apt?complex=<id>`, page group w-map) — this screen exists so the panel can be developed and
 * reviewed on its own (`/dev/w-complex?complex=<id>`), and as the reference integration.
 */
export function ComplexMapScreen() {
  const { complexId, setComplex } = useComplexParam();
  const { data: complex } = useQuery({
    queryKey: complexKeys.detail(complexId ?? ''),
    queryFn: ({ signal }) => fetchComplex(complexId!, signal),
    enabled: !!complexId,
    staleTime: 5 * 60_000,
  });
  const { data: nearby } = useQuery({
    queryKey: complexKeys.nearby(complexId ?? '', 10),
    queryFn: ({ signal }) => fetchNearbyComplexes(complexId!, 10, signal),
    enabled: !!complexId,
    staleTime: 5 * 60_000,
    retry: false,
  });

  return (
    <div className={styles.body}>
      <div className={styles.panel}>
        <ComplexPanelSlot
          sheet
          // Phones: this screen scrolls as a whole (map on top, panel below), so the panel grows.
          scroll="host"
          fallback={
            <div className={styles.none}>
              <EmptyState
                icon="building"
                title="단지를 선택해 주세요"
                description="주소에 ?complex=<단지 ID> 를 붙이면 단지 패널이 열려요."
              />
            </div>
          }
        />
      </div>
      <section className={styles.map} aria-label="단지 위치 지도">
        {complex && (
          <ComplexMap
            key={complex.id}
            complex={complex}
            nearby={nearby ?? []}
            onSelect={setComplex}
          />
        )}
      </section>
    </div>
  );
}
