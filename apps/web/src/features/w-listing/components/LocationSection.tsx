'use client';
import { Icon, SUNCHEON_MAP_VIEWBOX, cx } from '@house/ui';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MapView, MapZoomControl } from '@/components/map';
import { env } from '@/config/env';
import { projectToScreen } from '@/lib/map/geo';
import { kakaoPixelOffset } from '@/lib/map/kakao-level';
import type { LatLng, MapImpl } from '@/lib/map/types';
import { NEARBY_CATEGORY_LABEL, type NearbyPlace } from '../api/schemas';
import { Glyph, NEARBY_GLYPH } from './icons';
import styles from './page.module.css';

const ZOOM_DEFAULT = 15;
const ZOOM_MIN = 13;
const ZOOM_MAX = 17;

export interface LocationSectionProps {
  center: LatLng;
  /** Address line the API exposes publicly (never 호수). */
  address: string;
  markerTitle: string;
  /** "매매" */
  dealLabel: string;
  /** "4억 4,500" */
  priceText: string;
  nearby: readonly NearbyPlace[];
  /** Big-map URL centred on the listing. */
  mapHref: string;
  /** Short name for the mobile pin ("103동"). */
  shortTitle?: string | null;
}

/** 350 → "350m", 6800 → "6.8km" */
export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(Math.round(m / 100) / 10).toFixed(1)}km`;
}

type Size = { width: number; height: number };

/** Screen position of nearby places that fit inside the mini map without covering the pin. */
export function placePois(
  places: readonly NearbyPlace[],
  center: LatLng,
  zoom: number,
  size: Size,
  impl: MapImpl,
  max = 3,
): { place: NearbyPlace; x: number; y: number }[] {
  if (size.width === 0) return [];
  const out: { place: NearbyPlace; x: number; y: number }[] = [];
  for (const place of places) {
    if (
      place.lat === null ||
      place.lat === undefined ||
      place.lng === null ||
      place.lng === undefined
    )
      continue;
    const p = { lat: place.lat, lng: place.lng };
    let x: number;
    let y: number;
    if (impl === 'static') {
      ({ x, y } = projectToScreen(p, center, zoom, size, SUNCHEON_MAP_VIEWBOX));
    } else {
      const o = kakaoPixelOffset(p, center, zoom);
      x = size.width / 2 + o.x;
      y = size.height / 2 + o.y;
    }
    const inside = x > 70 && x < size.width - 70 && y > 24 && y < size.height - 24;
    const dx = x - size.width / 2;
    const dy = y - size.height / 2;
    const onPin = Math.abs(dx) < 150 && dy > -90 && dy < 44;
    const crowded = out.some((o) => Math.abs(o.x - x) < 120 && Math.abs(o.y - y) < 36);
    if (inside && !onPin && !crowded) out.push({ place, x, y });
    if (out.length >= max) break;
  }
  return out;
}

/** 위치 · 주변: non-interactive mini map centred on the listing + distances to nearby places. */
export function LocationSection({
  center,
  address,
  markerTitle,
  dealLabel,
  priceText,
  nearby,
  mapHref,
  shortTitle,
}: LocationSectionProps) {
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [impl, setImpl] = useState<MapImpl>(env.kakaoMapKey ? 'kakao' : 'static');
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const apply = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pois = placePois(nearby, center, zoom, size, impl);
  const label = `위치 지도: ${markerTitle}${
    nearby.length
      ? `. 주변에 ${nearby
          .slice(0, 3)
          .map((n) => n.name)
          .join(', ')}`
      : ''
  }`;

  return (
    <section className={styles.sec} aria-labelledby="s-loc">
      <div className={cx(styles.secHd, styles.secHdCol)}>
        <h2 className={styles.secT} id="s-loc">
          위치 <span className="only-lg">· 주변</span>
        </h2>
        <span className={styles.secCap}>{address}</span>
      </div>

      <div ref={boxRef} className={styles.minimap}>
        <MapView
          center={center}
          zoom={zoom}
          markers={[]}
          interactive={false}
          ariaLabel={label}
          onError={() => setImpl('static')}
        >
          {pois.map(({ place, x, y }) => (
            <span
              key={place.name}
              className={styles.poi}
              style={{ left: x, top: y }}
              aria-hidden="true"
            >
              <span className={styles.poiIc}>
                <Glyph name={NEARBY_GLYPH[place.category]} size={14} />
              </span>
              {place.name}
            </span>
          ))}
          <span className={styles.pin}>
            <span className={styles.pinC}>
              <Icon name="home" size={18} />
            </span>
            <span className={styles.pinT}>
              <span className={styles.pinN}>
                <span className="only-lg">{markerTitle}</span>
                <span className="only-sm">{shortTitle ?? markerTitle}</span>
              </span>
              <span className={styles.pinP}>
                {dealLabel} <b>{priceText}</b>
              </span>
            </span>
          </span>
          <div className={styles.mapTools}>
            <Link className={styles.mapTool} href={mapHref} aria-label="큰 지도에서 보기">
              <Icon name="expand" size={20} />
            </Link>
            <MapZoomControl
              onZoomIn={() => setZoom((z) => Math.min(ZOOM_MAX, z + 1))}
              onZoomOut={() => setZoom((z) => Math.max(ZOOM_MIN, z - 1))}
              canZoomIn={zoom < ZOOM_MAX}
              canZoomOut={zoom > ZOOM_MIN}
            />
          </div>
          <Link
            className={styles.mapCover}
            href={mapHref}
            aria-label={`지도에서 크게 보기: ${markerTitle}`}
          >
            <span className={styles.mapOpen}>
              <Icon name="expand" size={16} />
              지도 크게 보기
            </span>
          </Link>
        </MapView>
      </div>

      {nearby.length > 0 && (
        <ul className={styles.near} aria-label="주변 시설까지 거리">
          {nearby.map((n) => (
            <li key={`${n.category}-${n.name}`}>
              <span className={styles.nearIc}>
                <Glyph name={NEARBY_GLYPH[n.category]} size={20} />
              </span>
              <div className={styles.nearT}>
                <span className={styles.nearK}>{NEARBY_CATEGORY_LABEL[n.category]}</span>
                <b>{n.name}</b>
                {n.note && <span className={styles.nearNote}>{n.note}</span>}
              </div>
              <span className={cx(styles.nearD, 'num')}>{formatDistance(n.distanceM)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
