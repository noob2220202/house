'use client';
import { MAP_ZOOM } from '@house/shared';
import { cx } from '@house/ui';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { env } from '@/config/env';
import type { MapMarker } from '@/lib/map/types';
import type { MapViewProps } from './MapView';
import { MarkerView } from './markers';
import markerStyles from './markers.module.css';
import {
  loadNaverMaps,
  type NaverListener,
  type NaverMap,
  type NaverMaps,
  type NaverMarker,
} from './naver';
import styles from './StaticMapView.module.css';

interface Overlay {
  id: string;
  marker: NaverMarker;
  el: HTMLElement;
  model: MapMarker;
}

/**
 * Naver Maps JS v3 implementation. Markers are custom HTML overlays: each marker's `icon.content`
 * is a DOM node that React portals the shared marker components into, so both map implementations
 * render identical markers.
 */
export default function NaverMapView({
  center,
  zoom,
  markers,
  selectedId,
  onMarkerClick,
  onViewChange,
  onMapClick,
  onError,
  debounceMs = 250,
  interactive = true,
  ariaLabel = '지도',
  children,
  className,
}: MapViewProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<NaverMap | null>(null);
  const apiRef = useRef<NaverMaps | null>(null);
  const store = useRef(new Map<string, Overlay>());
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [ready, setReady] = useState(false);
  const lastEmitted = useRef<{ lat: number; lng: number; zoom: number } | null>(null);

  const handlers = useRef({ onViewChange, onMapClick, onError });
  handlers.current = { onViewChange, onMapClick, onError };
  const initial = useRef({ center, zoom, interactive, debounceMs });

  // 1) Load the SDK and create the map once.
  useEffect(() => {
    let cancelled = false;
    let listeners: NaverListener[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const overlayStore = store.current;
    loadNaverMaps(env.naverMapKeyId)
      .then((maps) => {
        if (cancelled || !elRef.current) return;
        const { center: c, zoom: z, interactive: inter, debounceMs: wait } = initial.current;
        const map = new maps.Map(elRef.current, {
          center: new maps.LatLng(c.lat, c.lng),
          zoom: z,
          minZoom: MAP_ZOOM.MIN,
          maxZoom: MAP_ZOOM.MAX,
          zoomControl: false,
          scaleControl: true,
          mapDataControl: false,
          mapTypeControl: false,
          draggable: inter,
          scrollWheel: inter,
          pinchZoom: inter,
          keyboardShortcuts: inter,
          disableDoubleClickZoom: !inter,
          tileTransition: true,
        });
        apiRef.current = maps;
        mapRef.current = map;
        const emit = () => {
          const ctr = map.getCenter();
          const b = map.getBounds();
          const next = { center: { lat: ctr.lat(), lng: ctr.lng() }, zoom: map.getZoom() };
          lastEmitted.current = { lat: next.center.lat, lng: next.center.lng, zoom: next.zoom };
          handlers.current.onViewChange?.({
            ...next,
            bounds: {
              swLat: b.getSW().lat(),
              swLng: b.getSW().lng(),
              neLat: b.getNE().lat(),
              neLng: b.getNE().lng(),
            },
          });
        };
        listeners = [
          maps.Event.addListener(map, 'idle', () => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(emit, wait);
          }),
          maps.Event.addListener(map, 'click', (e) => {
            if (e.coord) handlers.current.onMapClick?.({ lat: e.coord.lat(), lng: e.coord.lng() });
          }),
        ];
        setReady(true);
        emit();
      })
      .catch((error: unknown) => {
        if (!cancelled)
          handlers.current.onError?.(
            error instanceof Error ? error : new Error('Naver Maps failed to load'),
          );
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (apiRef.current && listeners.length > 0) apiRef.current.Event.removeListener(listeners);
      overlayStore.forEach((o) => o.marker.setMap(null));
      overlayStore.clear();
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, []);

  // 1b) Keep the tiles right when the container changes size (window resize, mobile sheet, side
  //     panel): one `autoResize()` per animation frame at most.
  useEffect(() => {
    const el = elRef.current;
    if (!ready || !el || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        mapRef.current?.autoResize();
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [ready]);

  // 2) Follow the controlled center/zoom (skip echoes of what the map itself just reported).
  useEffect(() => {
    const map = mapRef.current;
    const maps = apiRef.current;
    if (!ready || !map || !maps) return;
    const last = lastEmitted.current;
    if (
      last &&
      Math.abs(last.lat - center.lat) < 1e-5 &&
      Math.abs(last.lng - center.lng) < 1e-5 &&
      Math.abs(last.zoom - zoom) < 0.01
    )
      return;
    map.morph(new maps.LatLng(center.lat, center.lng), zoom);
  }, [ready, center.lat, center.lng, zoom]);

  // 3) Sync marker overlays with the `markers` prop (create / move / remove).
  useEffect(() => {
    const map = mapRef.current;
    const maps = apiRef.current;
    if (!ready || !map || !maps) return;
    const overlayStore = store.current;
    const seen = new Set<string>();
    for (const m of markers) {
      seen.add(m.id);
      const existing = overlayStore.get(m.id);
      if (existing) {
        existing.model = m;
        existing.marker.setPosition(new maps.LatLng(m.position.lat, m.position.lng));
      } else {
        const el = document.createElement('div');
        el.style.cssText = 'position:relative;width:0;height:0';
        const marker = new maps.Marker({
          position: new maps.LatLng(m.position.lat, m.position.lng),
          map,
          icon: { content: el, anchor: new maps.Point(0, 0) },
          clickable: true,
        });
        overlayStore.set(m.id, { id: m.id, marker, el, model: m });
      }
    }
    for (const [id, o] of overlayStore) {
      if (!seen.has(id)) {
        o.marker.setMap(null);
        overlayStore.delete(id);
      }
    }
    setOverlays(Array.from(overlayStore.values(), (o) => ({ ...o })));
  }, [ready, markers]);

  // 4) Selected marker on top, clusters at the bottom.
  useEffect(() => {
    overlays.forEach((o) =>
      o.marker.setZIndex(o.id === selectedId ? 1000 : o.model.kind === 'cluster' ? 10 : 100),
    );
  }, [selectedId, overlays]);

  return (
    <div
      className={cx(styles.map, className)}
      data-map-impl="naver"
      style={{ touchAction: 'auto' }}
    >
      <div
        ref={elRef}
        role="application"
        aria-label={ariaLabel}
        aria-roledescription="지도"
        style={{ position: 'absolute', inset: 0 }}
      />
      {overlays.map((o) =>
        createPortal(
          <span className={cx(markerStyles.anchor, o.id === selectedId && markerStyles.selected)}>
            <MarkerView
              marker={o.model}
              selected={o.id === selectedId}
              onClick={() => onMarkerClick?.(o.model)}
            />
          </span>,
          o.el,
          o.id,
        ),
      )}
      {children && <div className={styles.overlay}>{children}</div>}
    </div>
  );
}
