'use client';
import { SUNCHEON_MAP_VIEWBOX, SuncheonMapArt, cx } from '@house/ui';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import {
  STATIC_MAP_BOUNDS,
  clampZoom,
  projectToArt,
  projectToScreen,
  staticScale,
  staticViewBounds,
  unprojectFromArt,
} from '@/lib/map/geo';
import type { LatLng, MapViewState } from '@/lib/map/types';
import type { MapViewProps } from './MapView';
import { MarkerView } from './markers';
import markerStyles from './markers.module.css';
import styles from './StaticMapView.module.css';

const ART = SUNCHEON_MAP_VIEWBOX;

/** Place names drawn on the stylized map (positions in % of the art, from the design). */
const LABELS: readonly { text: string; x: number; y: number; kind?: 'water' | 'park' }[] = [
  { text: '조례동', x: 42, y: 14 },
  { text: '왕지동', x: 83, y: 10 },
  { text: '연향동', x: 38, y: 50 },
  { text: '덕연동', x: 24, y: 27 },
  { text: '장천동', x: 17, y: 74 },
  { text: '풍덕동', x: 66, y: 92 },
  { text: '동천', x: 29, y: 33, kind: 'water' },
  { text: '조례호수공원', x: 58, y: 20, kind: 'park' },
  { text: '순천만국가정원', x: 54, y: 96, kind: 'park' },
  { text: '봉화산', x: 6, y: 47, kind: 'park' },
];

/**
 * Fallback map used when no Kakao map key is configured (dev, tests, CI): the stylized Suncheon SVG
 * from the design with markers projected from lat/lng onto its bbox. Supports drag-pan,
 * wheel/keyboard zoom and emits the same `onViewChange` (with bounds) as the Kakao map.
 */
export default function StaticMapView({
  center,
  zoom,
  markers,
  selectedId,
  onMarkerClick,
  onViewChange,
  onMapClick,
  debounceMs = 200,
  interactive = true,
  ariaLabel = '지도',
  children,
  className,
}: MapViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [view, setView] = useState<MapViewState>({ center, zoom });
  const drag = useRef<{ x: number; y: number; center: LatLng; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  const emitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const viewRef = useRef(view);
  viewRef.current = view;

  // Follow controlled props (URL state, "locate me", marker click → zoom in).
  useEffect(() => {
    setView((v) =>
      v.center.lat === center.lat && v.center.lng === center.lng && v.zoom === zoom
        ? v
        : { center, zoom },
    );
  }, [center, zoom]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const emit = useCallback(
    (next: MapViewState, immediate = false) => {
      if (emitTimer.current) clearTimeout(emitTimer.current);
      const fire = () => {
        const el = ref.current;
        if (!el) return;
        const viewport = { width: el.clientWidth, height: el.clientHeight };
        onViewChangeRef.current?.({
          ...next,
          bounds: staticViewBounds(next.center, next.zoom, viewport, ART),
        });
      };
      if (immediate) fire();
      else emitTimer.current = setTimeout(fire, debounceMs);
    },
    [debounceMs],
  );
  useEffect(
    () => () => {
      if (emitTimer.current) clearTimeout(emitTimer.current);
    },
    [],
  );

  // Report the initial bounds once the size is known (so the page can run its first query).
  const reported = useRef(false);
  useEffect(() => {
    if (reported.current || size.width === 0) return;
    reported.current = true;
    emit(viewRef.current, true);
  }, [size.width, emit]);

  const update = (next: MapViewState) => {
    setView(next);
    emit(next);
  };

  const scale = staticScale(size, ART, view.zoom);
  const c = projectToArt(view.center, STATIC_MAP_BOUNDS, ART);
  const tx = size.width / 2 - c.x * scale;
  const ty = size.height / 2 - c.y * scale;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!interactive || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, a, input, select, [role="dialog"]')) return;
    drag.current = { x: e.clientX, y: e.clientY, center: view.center, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    if (!d.moved) return;
    const start = projectToArt(d.center, STATIC_MAP_BOUNDS, ART);
    update({
      center: unprojectFromArt(
        { x: start.x - dx / scale, y: start.y - dy / scale },
        STATIC_MAP_BOUNDS,
        ART,
      ),
      zoom: view.zoom,
    });
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (d && !d.moved && onMapClick) {
      const rect = e.currentTarget.getBoundingClientRect();
      onMapClick(
        unprojectFromArt(
          { x: (e.clientX - rect.left - tx) / scale, y: (e.clientY - rect.top - ty) / scale },
          STATIC_MAP_BOUNDS,
          ART,
        ),
      );
    }
  };

  // Wheel zoom needs a non-passive listener to prevent page scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const nextZoom = clampZoom(Math.round((v.zoom + (e.deltaY < 0 ? 0.5 : -0.5)) * 2) / 2);
      if (nextZoom === v.zoom) return;
      const next = { center: v.center, zoom: nextZoom };
      setView(next);
      emit(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [interactive, emit]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || e.target !== e.currentTarget) return;
    const step = 80 / scale;
    const a = projectToArt(view.center, STATIC_MAP_BOUNDS, ART);
    const moveTo = (x: number, y: number): MapViewState => ({
      zoom: view.zoom,
      center: unprojectFromArt({ x, y }, STATIC_MAP_BOUNDS, ART),
    });
    let next: MapViewState | null = null;
    if (e.key === 'ArrowLeft') next = moveTo(a.x - step, a.y);
    else if (e.key === 'ArrowRight') next = moveTo(a.x + step, a.y);
    else if (e.key === 'ArrowUp') next = moveTo(a.x, a.y - step);
    else if (e.key === 'ArrowDown') next = moveTo(a.x, a.y + step);
    else if (e.key === '+' || e.key === '=')
      next = { center: view.center, zoom: clampZoom(view.zoom + 1) };
    else if (e.key === '-' || e.key === '_')
      next = { center: view.center, zoom: clampZoom(view.zoom - 1) };
    if (next) {
      e.preventDefault();
      update(next);
    }
  };

  const ready = size.width > 0;
  return (
    <div
      ref={ref}
      className={cx(
        styles.map,
        interactive && (dragging ? styles.grabbing : styles.grab),
        className,
      )}
      role="application"
      aria-label={interactive ? `${ariaLabel} (방향키로 이동, +/- 키로 확대·축소)` : ariaLabel}
      aria-roledescription="지도"
      tabIndex={interactive ? 0 : -1}
      data-map-impl="static"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
    >
      {ready && (
        <>
          <SuncheonMapArt
            className={styles.art}
            width={ART.width}
            height={ART.height}
            preserveAspectRatio="none"
            style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}
          />
          {LABELS.map((l) => (
            <span
              key={l.text}
              className={cx(
                styles.label,
                l.kind === 'water' && styles.water,
                l.kind === 'park' && styles.park,
              )}
              style={{
                left: tx + (l.x / 100) * ART.width * scale,
                top: ty + (l.y / 100) * ART.height * scale,
              }}
              aria-hidden="true"
            >
              {l.text}
            </span>
          ))}
          <div className={styles.markers}>
            {markers.map((m) => {
              const p = projectToScreen(m.position, view.center, view.zoom, size, ART);
              if (p.x < -120 || p.y < -80 || p.x > size.width + 120 || p.y > size.height + 120)
                return null;
              const selected = m.id === selectedId;
              return (
                <div
                  key={m.id}
                  className={cx(markerStyles.anchor, selected && markerStyles.selected)}
                  style={{ left: p.x, top: p.y }}
                >
                  <MarkerView marker={m} selected={selected} onClick={() => onMarkerClick?.(m)} />
                </div>
              );
            })}
          </div>
        </>
      )}
      {children && <div className={styles.overlay}>{children}</div>}
    </div>
  );
}
