'use client';
import { Icon, Popover, Spinner, cx } from '@house/ui';
import type { ReactNode } from 'react';
import type { MapBounds } from '@/lib/map';
import { scaleBar } from '../../lib/geo';
import s from './map.module.css';

export interface LayerState {
  trade: boolean;
}

/**
 * Map layer panel (design `.layers`). 실거래가 switches the complex markers to the latest trade
 * price. The design's 지적편집도 / 학군 (and the 원룸 map's 통학 도보권 · 편의시설 · CCTV with the walk
 * radius) are out of scope for launch (DECISIONS D6), so no button is shown for them.
 */
export interface MapLayersProps {
  layers: LayerState;
  onToggleTrade: () => void;
  /** Lay the buttons out in a row (inside the collapsed 레이어 popover). */
  row?: boolean;
  className?: string;
}

export function MapLayers({ layers, onToggleTrade, row, className }: MapLayersProps) {
  return (
    <div
      className={cx(s.layers, row && s.layersRow, className)}
      role="group"
      aria-label="지도 레이어"
    >
      <button
        type="button"
        className={s.layerB}
        aria-pressed={layers.trade}
        onClick={onToggleTrade}
      >
        <Icon name="chart" size={20} />
        실거래가
      </button>
    </div>
  );
}

/**
 * The layer panel folded into one 44px tool button — for maps too short to stack the panel above
 * the zoom control (small laptops). The button is tinted while a layer is on.
 */
export function MapLayersButton(props: Omit<MapLayersProps, 'row' | 'className'>) {
  const on = props.layers.trade;
  return (
    <Popover
      label="지도 레이어"
      placement="bottom-end"
      flush
      trigger={(p) => (
        <button
          type="button"
          className={cx(s.layerToggle, on && s.layerToggleOn)}
          aria-label={on ? '지도 레이어, 실거래가 켜짐' : '지도 레이어'}
          {...p}
        >
          <Icon name="layers" size={20} />
        </button>
      )}
    >
      <MapLayers {...props} row />
    </Popover>
  );
}

/** Blue "you are here" dot (내 위치) — positioned by the page from the visible bounds. */
export function MyLocationDot({ x, y }: { x: number; y: number }) {
  return (
    <span className={s.me} style={{ left: x, top: y }} role="img" aria-label="내 위치">
      <i aria-hidden="true" />
    </span>
  );
}

/** Scale bar computed from the visible bounds (works for both map implementations). */
export function ScaleBar({ bounds, width }: { bounds: MapBounds | null; width: number }) {
  const bar = bounds ? scaleBar(bounds, width) : null;
  if (!bar) return null;
  return (
    <span className={s.scale} aria-hidden="true">
      <i style={{ width: bar.px }} />
      {bar.label}
    </span>
  );
}

/** Colour legend of the price markers (월세 · 전세 · 매매). */
export function DealLegend({ deals }: { deals: readonly ('monthly' | 'jeonse' | 'sale')[] }) {
  const LABEL = { monthly: '월세 보증금/월세(만)', jeonse: '전세(만)', sale: '매매' } as const;
  return (
    <span className={s.legend}>
      {deals.map((d) => (
        <span key={d} className={s[`lg_${d}`]}>
          <i aria-hidden="true" />
          {LABEL[d]}
        </span>
      ))}
    </span>
  );
}

/** Floating status pill at the top of the map: loading / error / empty / truncated. */
export function MapStatus({
  tone = 'info',
  children,
  action,
}: {
  tone?: 'info' | 'loading' | 'error';
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <p
      className={cx(s.status, tone === 'error' && s.statusError)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {tone === 'loading' && <Spinner size={16} />}
      {children}
      {action}
    </p>
  );
}
