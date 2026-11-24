'use client';
import { Icon, cx } from '@house/ui';
import { useEffect, useRef, useState } from 'react';
import { MapView, MapZoomControl } from '@/components/map';
import { MAP_ZOOM, clampZoom, roundCoord, type LatLng, type MapViewChange } from '@/lib/map';
import styles from './wizard.module.css';

export interface PinPickerProps {
  /** Chosen position, or null while nothing has been picked. */
  value: LatLng | null;
  onChange: (position: LatLng) => void;
  invalid?: boolean;
  describedBy?: string;
}

const PICK_ZOOM = 16;
/** Overview before anything is picked (연향동 — the middle of the city). */
const OVERVIEW: { center: LatLng; zoom: number } = {
  center: { lat: 34.948, lng: 127.525 },
  zoom: 13,
};
/** Positions closer than ~2 m count as the same point. */
const same = (a: LatLng, b: LatLng) =>
  Math.abs(a.lat - b.lat) < 2e-5 && Math.abs(a.lng - b.lng) < 2e-5;

/**
 * "Move the map under the pin" picker for listings without a complex: the pin stays in the centre
 * and the chosen position is the map centre. Mouse, touch and keyboard (arrow keys pan the map).
 */
export function PinPicker({ value, onChange, invalid, describedBy }: PinPickerProps) {
  const [view, setView] = useState<{ center: LatLng; zoom: number }>({
    center: value ?? OVERVIEW.center,
    zoom: value ? PICK_ZOOM : OVERVIEW.zoom,
  });
  const [moving, setMoving] = useState(false);
  const centerRef = useRef(view.center);
  centerRef.current = view.center;

  // Follow outside changes (address selected → jump to its coordinates).
  useEffect(() => {
    if (value && !same(value, centerRef.current)) {
      setView((v) => ({ center: value, zoom: Math.max(v.zoom, PICK_ZOOM) }));
    }
  }, [value]);

  const handleViewChange = (change: MapViewChange) => {
    setMoving(false);
    const center = { lat: roundCoord(change.center.lat), lng: roundCoord(change.center.lng) };
    const moved = !same(center, centerRef.current);
    setView({ center, zoom: change.zoom });
    // The first emission (mount) and pure zooms keep the centre → not a pick.
    if (moved && (!value || !same(center, value))) onChange(center);
  };

  const zoomBy = (delta: number) =>
    setView((v) => ({ center: v.center, zoom: clampZoom(v.zoom + delta) }));

  return (
    <div
      className={cx(styles.picker, invalid && styles.pickerInvalid)}
      onPointerDown={() => setMoving(true)}
      onPointerUp={() => setMoving(false)}
      onPointerCancel={() => setMoving(false)}
      aria-describedby={describedBy}
    >
      <MapView
        center={view.center}
        zoom={view.zoom}
        markers={[]}
        onViewChange={handleViewChange}
        debounceMs={150}
        ariaLabel="매물 위치 지정 지도"
      >
        <span
          className={cx(styles.pin, moving && styles.pinUp, !value && styles.pinIdle)}
          aria-hidden="true"
        >
          <Icon name="map-pin" size={22} />
        </span>
        <span className={styles.pinShadow} aria-hidden="true" />
        <MapZoomControl
          className={styles.pickerZoom}
          onZoomIn={() => zoomBy(1)}
          onZoomOut={() => zoomBy(-1)}
          canZoomIn={view.zoom < MAP_ZOOM.MAX}
          canZoomOut={view.zoom > MAP_ZOOM.MIN}
        />
        <p className={styles.pickerHint}>
          {value
            ? '지도를 움직여 핀을 건물 위에 맞춰 주세요'
            : '주소를 검색하면 지도가 그 위치로 이동해요'}
        </p>
      </MapView>
    </div>
  );
}
