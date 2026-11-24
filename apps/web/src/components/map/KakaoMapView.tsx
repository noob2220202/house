'use client';
import { cx } from '@house/ui';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { env } from '@/config/env';
import { KAKAO_LEVEL, kakaoLevelToZoom, zoomToKakaoLevel } from '@/lib/map/kakao-level';
import type { MapMarker } from '@/lib/map/types';
import {
  loadKakaoMaps,
  type KakaoCustomOverlay,
  type KakaoHandler,
  type KakaoMap,
  type KakaoMaps,
} from './kakao';
import type { MapViewProps } from './MapView';
import { MarkerView } from './markers';
import markerStyles from './markers.module.css';
import styles from './StaticMapView.module.css';

interface Overlay {
  id: string;
  overlay: KakaoCustomOverlay;
  el: HTMLElement;
  model: MapMarker;
}

/** Centre/level the map was last told or last reported (to skip echoes of our own reports). */
interface ViewMark {
  lat: number;
  lng: number;
  level: number;
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-5;

/**
 * Kakao Maps JS SDK implementation. The app's zoom is converted to Kakao levels with
 * `zoomToKakaoLevel` / `kakaoLevelToZoom` (levels are inverted: 1 = closest). Markers are
 * `CustomOverlay`s whose content is a DOM node that React portals the shared marker components
 * into, so both map implementations render identical markers. Clustering is done by the API
 * (`/map/search` region/grid clusters), so no SDK clusterer is used.
 */
export default function KakaoMapView({
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
  const mapRef = useRef<KakaoMap | null>(null);
  const apiRef = useRef<KakaoMaps | null>(null);
  const store = useRef(new Map<string, Overlay>());
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [ready, setReady] = useState(false);
  const lastEmitted = useRef<ViewMark | null>(null);

  const handlers = useRef({ onViewChange, onMapClick, onError });
  handlers.current = { onViewChange, onMapClick, onError };
  const initial = useRef({ center, zoom, interactive, debounceMs });

  // 1) Load the SDK and create the map once.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unlisten: (() => void) | null = null;
    const overlayStore = store.current;
    const el = elRef.current;
    loadKakaoMaps(env.kakaoMapKey)
      .then((maps) => {
        if (cancelled || !elRef.current) return;
        const { center: c, zoom: z, interactive: inter, debounceMs: wait } = initial.current;
        const map = new maps.Map(elRef.current, {
          center: new maps.LatLng(c.lat, c.lng),
          level: zoomToKakaoLevel(z),
          minLevel: KAKAO_LEVEL.MIN,
          maxLevel: KAKAO_LEVEL.MAX,
          draggable: inter,
          scrollwheel: inter,
          disableDoubleClickZoom: !inter,
          keyboardShortcuts: inter,
          tileAnimation: true,
        });
        // Pinch zoom has no constructor option.
        if (!inter) map.setZoomable(false);
        apiRef.current = maps;
        mapRef.current = map;
        const emit = () => {
          const ctr = map.getCenter();
          const b = map.getBounds();
          const level = map.getLevel();
          const next = {
            center: { lat: ctr.getLat(), lng: ctr.getLng() },
            zoom: kakaoLevelToZoom(level),
          };
          lastEmitted.current = { lat: next.center.lat, lng: next.center.lng, level };
          handlers.current.onViewChange?.({
            ...next,
            bounds: {
              swLat: b.getSouthWest().getLat(),
              swLng: b.getSouthWest().getLng(),
              neLat: b.getNorthEast().getLat(),
              neLng: b.getNorthEast().getLng(),
            },
          });
        };
        const onIdle: KakaoHandler = () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(emit, wait);
        };
        const onClick: KakaoHandler = (e) => {
          const p = e?.latLng;
          if (p) handlers.current.onMapClick?.({ lat: p.getLat(), lng: p.getLng() });
        };
        maps.event.addListener(map, 'idle', onIdle);
        maps.event.addListener(map, 'click', onClick);
        unlisten = () => {
          maps.event.removeListener(map, 'idle', onIdle);
          maps.event.removeListener(map, 'click', onClick);
        };
        setReady(true);
        emit();
      })
      .catch((error: unknown) => {
        if (!cancelled)
          handlers.current.onError?.(
            error instanceof Error ? error : new Error('Kakao Maps failed to load'),
          );
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unlisten?.();
      overlayStore.forEach((o) => o.overlay.setMap(null));
      overlayStore.clear();
      mapRef.current = null;
      // Kakao maps have no destroy(): drop the tiles/DOM it put into our container (a remount —
      // React strict mode, HMR — would otherwise stack a second map on top of the first).
      if (el) el.replaceChildren();
    };
  }, []);

  // 1b) Keep the tiles right when the container changes size (window resize, mobile sheet, side
  //     panel): one `relayout()` per animation frame at most.
  useEffect(() => {
    const el = elRef.current;
    if (!ready || !el || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        mapRef.current?.relayout();
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
    const level = zoomToKakaoLevel(zoom);
    const last = lastEmitted.current;
    if (last && near(last.lat, center.lat) && near(last.lng, center.lng) && last.level === level)
      return;
    const ctr = map.getCenter();
    const sameCenter = near(ctr.getLat(), center.lat) && near(ctr.getLng(), center.lng);
    const target = new maps.LatLng(center.lat, center.lng);
    if (map.getLevel() !== level) {
      map.setLevel(level);
      if (!sameCenter) map.setCenter(target);
    } else if (!sameCenter) {
      map.panTo(target);
    }
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
        existing.overlay.setPosition(new maps.LatLng(m.position.lat, m.position.lng));
      } else {
        const el = document.createElement('div');
        el.style.cssText = 'position:relative;width:0;height:0';
        const overlay = new maps.CustomOverlay({
          position: new maps.LatLng(m.position.lat, m.position.lng),
          content: el,
          map,
          xAnchor: 0,
          yAnchor: 0,
          clickable: true,
        });
        overlayStore.set(m.id, { id: m.id, overlay, el, model: m });
      }
    }
    for (const [id, o] of overlayStore) {
      if (!seen.has(id)) {
        o.overlay.setMap(null);
        overlayStore.delete(id);
      }
    }
    setOverlays(Array.from(overlayStore.values(), (o) => ({ ...o })));
  }, [ready, markers]);

  // 4) Selected marker on top, clusters at the bottom.
  useEffect(() => {
    overlays.forEach((o) =>
      o.overlay.setZIndex(o.id === selectedId ? 1000 : o.model.kind === 'cluster' ? 10 : 100),
    );
  }, [selectedId, overlays]);

  return (
    <div
      className={cx(styles.map, className)}
      data-map-impl="kakao"
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
