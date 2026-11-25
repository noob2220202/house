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

/**
 * Fallback map used when no Kakao map key is configured (dev, tests, CI): the stylized Suncheon SVG
 * from the design with markers projected from lat/lng onto its bbox. The art is not real geography,
 * so it carries no place names — only the markers (real data) are labelled. Supports drag-pan,
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
