'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  loadKakaoMaps,
  type KakaoCustomOverlay,
  type KakaoHandler,
  type KakaoMaps,
} from '@/components/map/kakao';
import { env } from '@/config/env';
import {
  kakaoHeroLayout,
  type HeroLayout,
  type HeroRegionChip,
  type HeroRegionInput,
  type KakaoHeroLayout,
  type Rect,
} from '../../lib/hero-map';
import { whenVisibleAndIdle } from '../../lib/when-visible-idle';
import { HeroChip } from './HeroChip';
import styles from './HeroMap.module.css';

/** Tiles that have not arrived by then → keep the static map. */
const TILES_TIMEOUT_MS = 10_000;
/** Kakao logo + copyright, moved to the bottom-right corner (the card covers bottom-left). */
const COPYRIGHT = { width: 190, height: 30 };
const SIDE_INSET = 56;
/** Half a chip + a gap below the top bar / above the bottom edge. */
const TOP_GAP = 26;
const BOTTOM_INSET = 30;

const at = (x: number, y: number) => ({ left: `${x}%`, top: `${y}%` });

interface LiveChip {
  chip: HeroRegionChip;
  el: HTMLElement;
}
interface Live {
  chips: LiveChip[];
  onCode: string | null;
}

export interface HeroMapLayerProps {
  /** Candidate regions with their real coordinates (already trimmed to the busiest ones). */
  regions: readonly HeroRegionInput[];
  featuredEmdName: string | null;
  /** Server-computed layout of the static fallback (chips in % of the frame). */
  staticLayout: HeroLayout;
  /** Abstract background art of the static fallback (server component). */
  art: ReactNode;
}

/**
 * Map layer of the hero card. Server-renders the static fallback (abstract art + chips as plain
 * links, so the HTML has them without JS). With a Kakao key, once the card is visible and the page
 * is idle it loads the SDK, builds a non-interactive map fitted to the regions and — only when the
 * tiles have loaded — swaps the art for the map, with the chips as `CustomOverlay`s at the
 * regions' real coordinates. Any SDK failure keeps the static version.
 */
export function HeroMapLayer({ regions, featuredEmdName, staticLayout, art }: HeroMapLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<Live | null>(null);
  const key = env.kakaoMapKey;
  const initial = useRef({ regions, featuredEmdName });

  useEffect(() => {
    const layer = layerRef.current;
    const el = mapRef.current;
    if (!key || !layer || !el || initial.current.regions.length === 0) return;
    let cancelled = false;
    let teardown: (() => void) | null = null;
    const cancelWait = whenVisibleAndIdle(layer, () => {
      loadKakaoMaps(key)
        .then((maps) => {
          if (cancelled) return;
          teardown = mountHeroMap(maps, el, layer, initial.current, (next) => {
            if (!cancelled) setLive(next);
          });
        })
        .catch((error: unknown) => {
          if (!cancelled)
            console.warn(
              '[hero-map] keeping the static map:',
              error instanceof Error ? error.message : error,
            );
        });
    });
    return () => {
      cancelled = true;
      cancelWait();
      teardown?.();
    };
  }, [key]);

  return (
    <div ref={layerRef} className={styles.layer} data-hero-map={live ? 'kakao' : 'static'}>
      {key && (
        <div className={`${styles.kakao} ${live ? styles.kakaoOn : ''}`} aria-hidden={!live}>
          <div ref={mapRef} className={styles.kakaoMap} />
        </div>
      )}
      {live ? (
        live.chips.map(({ chip, el }) =>
          createPortal(<HeroChip chip={chip} on={chip.code === live.onCode} />, el, chip.code),
        )
      ) : (
        <>
          {art}
          {staticLayout.chips.map((c) => (
            <HeroChip
              key={c.code}
              chip={c}
              on={c.code === staticLayout.onCode}
              style={at(c.x, c.y)}
            />
          ))}
        </>
      )}
    </div>
  );
}

/** Frame chrome (top bar, featured card) relative to the frame, from `data-hero-obstacle`. */
function measure(frame: HTMLElement) {
  const box = frame.getBoundingClientRect();
  const size = { width: box.width, height: box.height };
  const rel = (el: Element): Rect => {
    const r = el.getBoundingClientRect();
    return { x: r.left - box.left, y: r.top - box.top, width: r.width, height: r.height };
  };
  const root = frame.parentElement ?? frame;
  const top = root.querySelector('[data-hero-obstacle="top"]');
  const cardEl = root.querySelector('[data-hero-obstacle="card"]');
  const topRect = top ? rel(top) : null;
  const card = cardEl ? rel(cardEl) : null;
  const copyright: Rect = {
    x: size.width - COPYRIGHT.width,
    y: size.height - COPYRIGHT.height,
    ...COPYRIGHT,
  };
  const obstacles = [topRect, card, copyright].filter((r): r is Rect => r !== null);
  const insets = {
    top: (topRect ? topRect.y + topRect.height : 0) + TOP_GAP,
    right: SIDE_INSET,
    bottom: BOTTOM_INSET,
    left: SIDE_INSET,
  };
  return { size, obstacles, card, insets };
}

/**
 * Creates the Kakao map in `el` (sized like `frame`), and calls `onLive` with the chip overlays
 * once the tiles have loaded, and again after every resize. Returns the teardown.
 */
export function mountHeroMap(
  maps: KakaoMaps,
  el: HTMLElement,
  frame: HTMLElement,
  input: { regions: readonly HeroRegionInput[]; featuredEmdName: string | null },
  onLive: (live: Live) => void,
): () => void {
  const compute = (): KakaoHeroLayout | null =>
    kakaoHeroLayout(input.regions, { ...measure(frame), featuredEmdName: input.featuredEmdName });

  const first = compute();
  if (!first) return () => {};
  const map = new maps.Map(el, {
    center: new maps.LatLng(first.center.lat, first.center.lng),
    level: first.level,
    // A picture of the city, not a map to explore: the page scroll and keys stay the page's.
    draggable: false,
    scrollwheel: false,
    disableDoubleClick: true,
    disableDoubleClickZoom: true,
    keyboardShortcuts: false,
    tileAnimation: false,
  });
  map.setZoomable(false);
  if (maps.CopyrightPosition) map.setCopyrightPosition?.(maps.CopyrightPosition.BOTTOMRIGHT, true);

  let overlays: KakaoCustomOverlay[] = [];
  let shown = false;
  let frameId = 0;
  let observer: ResizeObserver | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const render = (layout: KakaoHeroLayout) => {
    overlays.forEach((o) => o.setMap(null));
    overlays = [];
    const chips = layout.chips.map((chip) => {
      const content = document.createElement('div');
      content.style.cssText = 'position:relative;width:0;height:0';
      overlays.push(
        new maps.CustomOverlay({
          position: new maps.LatLng(chip.lat, chip.lng),
          content,
          map,
          xAnchor: 0,
          yAnchor: 0,
          zIndex: chip.code === layout.onCode ? 3 : 2,
          clickable: true,
        }),
      );
      return { chip, el: content };
    });
    onLive({ chips, onCode: layout.onCode });
  };
  const relayout = () => {
    map.relayout();
    const layout = compute();
    if (!layout) return;
    map.setLevel(layout.level);
    map.setCenter(new maps.LatLng(layout.center.lat, layout.center.lng));
    render(layout);
  };

  const onTiles: KakaoHandler = () => {
    if (shown) return;
    shown = true;
    clearTimeout(timer);
    render(first);
    if (typeof ResizeObserver === 'undefined') return;
    let last = `${frame.clientWidth}x${frame.clientHeight}`;
    observer = new ResizeObserver(() => {
      const now = `${frame.clientWidth}x${frame.clientHeight}`;
      if (now === last || frameId) return;
      last = now;
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        relayout();
      });
    });
    observer.observe(frame);
  };
  maps.event.addListener(map, 'tilesloaded', onTiles);
  timer = setTimeout(() => {
    if (shown) return;
    console.warn('[hero-map] Kakao tiles did not load in time; keeping the static map');
    destroy();
  }, TILES_TIMEOUT_MS);

  function destroy() {
    clearTimeout(timer);
    maps.event.removeListener(map, 'tilesloaded', onTiles);
    observer?.disconnect();
    if (frameId) cancelAnimationFrame(frameId);
    overlays.forEach((o) => o.setMap(null));
    overlays = [];
    // Kakao maps have no destroy(): drop what the SDK put into the container.
    el.replaceChildren();
  }
  return destroy;
}
