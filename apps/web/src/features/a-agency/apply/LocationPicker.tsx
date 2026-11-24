'use client';
import { Icon, cx } from '@house/ui';
import { useEffect, useRef, useState, type Ref } from 'react';
import { MapView, MapZoomControl } from '@/components/map';
import { MAP_ZOOM, clampZoom, roundCoord, type LatLng, type MapViewChange } from '@/lib/map';
import { MIN_PICK_ZOOM, SERVICE_AREA_MESSAGE, isInServiceArea } from '../lib/location';
import styles from './Apply.module.css';

export interface LocationPickerProps {
  /** Chosen office position, or null while nothing has been picked. */
  value: LatLng | null;
  onChange: (position: LatLng) => void;
  /** Error look (position missing on submit). */
  invalid?: boolean;
  /** id of the element describing the map (hint / error) for aria-describedby. */
  describedBy?: string;
  /** Wrapper element (the form focuses the map through it on a validation error). */
  ref?: Ref<HTMLDivElement>;
}

const PICK_ZOOM = 16;
/** Overview shown before anything is picked (연향동 — the middle of the city). */
const OVERVIEW: { center: LatLng; zoom: number } = {
  center: { lat: 34.948, lng: 127.525 },
  zoom: 13,
};
/** Positions closer than ~2 m count as the same point (coordinates are rounded to 5 decimals). */
const same = (a: LatLng, b: LatLng) =>
  Math.abs(a.lat - b.lat) < 2e-5 && Math.abs(a.lng - b.lng) < 2e-5;

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

/** True on touch-first devices (one-finger drags should scroll the page until the map is activated). */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)');
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return coarse;
}

/**
 * "Move the map under the pin" position picker: the pin stays in the centre of the map and the
 * chosen position is the map centre. Works the same on the Naver map and the static fallback, with
 * mouse, touch and keyboard (arrow keys pan the map).
 *
 * Embedded in a long form, the map must not trap scrolling: a plain mouse wheel scrolls the page
 * (Ctrl/⌘ + wheel zooms the map), and on touch screens the map is inert until tapped. A pan only
 * counts as a pick at street level (zoom ≥ MIN_PICK_ZOOM) and inside the service area.
 */
export function LocationPicker({
  value,
  onChange,
  invalid,
  describedBy,
  ref,
}: LocationPickerProps) {
  const [view, setView] = useState<{ center: LatLng; zoom: number }>({
    center: value ?? OVERVIEW.center,
    zoom: value ? PICK_ZOOM : OVERVIEW.zoom,
  });
  const [moving, setMoving] = useState(false);
  const [outside, setOutside] = useState(false);
  const [wheelHint, setWheelHint] = useState(false);
  const coarse = useCoarsePointer();
  const [touchActive, setTouchActive] = useState(false);
  const centerRef = useRef(view.center);
  centerRef.current = view.center;
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Follow outside changes (address selected → jump to its coordinates).
  useEffect(() => {
    if (value && !same(value, centerRef.current)) {
      setView((v) => ({ center: value, zoom: Math.max(v.zoom, PICK_ZOOM) }));
    }
  }, [value]);

  // Plain wheel → page scroll (stopped before it reaches the map's own listener); Ctrl/⌘ → zoom.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      e.stopPropagation();
      setWheelHint(true);
      clearTimeout(timer);
      timer = setTimeout(() => setWheelHint(false), 1400);
    };
    el.addEventListener('wheel', onWheel, { capture: true });
    return () => {
      clearTimeout(timer);
      el.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, []);

  // A touch activation ends when the user touches anything outside the map.
  useEffect(() => {
    if (!touchActive) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setTouchActive(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [touchActive]);

  const handleViewChange = (change: MapViewChange) => {
    setMoving(false);
    const center = { lat: roundCoord(change.center.lat), lng: roundCoord(change.center.lng) };
    const moved = !same(center, centerRef.current);
    setView({ center, zoom: change.zoom });
    // The first emission (mount) and pure zooms keep the centre → not a pick. Overview zooms are
    // too coarse to pick from, and positions outside 순천시 are refused.
    if (!moved || change.zoom < MIN_PICK_ZOOM) return;
    if (!isInServiceArea(center)) {
      setOutside(true);
      return;
    }
    setOutside(false);
    if (!value || !same(center, value)) onChange(center);
  };

  const zoomBy = (delta: number) =>
    setView((v) => ({ center: v.center, zoom: clampZoom(v.zoom + delta) }));

  const tooFar = view.zoom < MIN_PICK_ZOOM;
  const hint = wheelHint
    ? `${isMac() ? '⌘' : 'Ctrl'} + 스크롤로 지도를 확대할 수 있어요`
    : outside
      ? SERVICE_AREA_MESSAGE
      : tooFar
        ? value
          ? '지도를 더 확대하면 핀 위치를 맞출 수 있어요'
          : '주소를 검색하거나 지도를 확대해서 위치를 지정해 주세요'
        : value
          ? '지도를 움직여 핀 위치를 맞출 수 있어요'
          : '주소를 검색하거나 지도를 움직여 위치를 지정해 주세요';

  const setRefs = (el: HTMLDivElement | null) => {
    rootRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  return (
    <div
      ref={setRefs}
      tabIndex={-1}
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
        ariaLabel="사무소 위치 지정 지도"
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
        <p
          className={cx(styles.pickerHint, (outside || wheelHint) && styles.pickerHintStrong)}
          aria-live="polite"
        >
          {hint}
        </p>
      </MapView>
      {coarse && !touchActive && (
        <button
          type="button"
          className={styles.pickerActivate}
          onClick={() => setTouchActive(true)}
        >
          <span>
            <Icon name="map-pin" size={16} />
            눌러서 위치 조정하기
          </span>
        </button>
      )}
    </div>
  );
}
