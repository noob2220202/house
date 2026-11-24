import {
  Button,
  DEAL_KIND_LABEL,
  Icon,
  IconButton,
  cx,
  type DealKind,
  type LinkAs,
} from '@house/ui';
import type { ReactNode } from 'react';
import type {
  ClusterMarker,
  ComplexMarker,
  MapMarker,
  PinMarker,
  PriceMarker,
} from '@/lib/map/types';
import styles from './markers.module.css';
import { formatCount } from '@/lib/format';

interface MarkerProps<M> {
  marker: M;
  selected?: boolean;
  onClick?: () => void;
}

/** District / grid cluster bubble: name + count. */
export function ClusterBubble({ marker, selected, onClick }: MarkerProps<ClusterMarker>) {
  return (
    <button
      type="button"
      className={cx(
        styles.marker,
        styles.cluster,
        marker.outer && styles.outer,
        marker.size === 'sm' && styles.sm,
        selected && styles.on,
      )}
      onClick={onClick}
      aria-label={
        marker.ariaLabel ??
        `${marker.name ?? '이 지역'} 매물 ${formatCount(marker.count)}건, 확대해서 보기`
      }
    >
      {marker.name && <span className={styles.clusterName}>{marker.name}</span>}
      <span className={styles.clusterCount}>{formatCount(marker.count)}</span>
    </button>
  );
}

/** Complex marker: count badge + name + "34평 4.4억". */
export function ComplexMarkerView({ marker, selected, onClick }: MarkerProps<ComplexMarker>) {
  const lead = [marker.areaLabel, marker.dealNote].filter(Boolean).join(' ');
  return (
    <button
      type="button"
      className={cx(
        styles.marker,
        styles.mk,
        marker.presale && styles.presale,
        selected && styles.on,
      )}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={
        marker.ariaLabel ??
        `${marker.name}, 매물 ${marker.count}건${marker.priceLabel ? `, ${lead} ${marker.priceLabel}` : ''}`
      }
    >
      <span className={styles.mkCount}>{formatCount(marker.count)}</span>
      <span className={styles.mkText}>
        <span className={styles.mkName}>{marker.name}</span>
        {(lead || marker.priceLabel) && (
          <span className={styles.mkPrice}>
            {lead} {marker.priceLabel && <b>{marker.priceLabel}</b>}
          </span>
        )}
      </span>
    </button>
  );
}

/** Single-listing price pill with a deal-coloured dot. */
export function PriceMarkerView({ marker, selected, onClick }: MarkerProps<PriceMarker>) {
  return (
    <button
      type="button"
      className={cx(styles.marker, styles.pmk, styles[marker.deal], selected && styles.on)}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={marker.ariaLabel ?? `${DEAL_KIND_LABEL[marker.deal]} ${marker.priceLabel}`}
    >
      <i aria-hidden="true" />
      {marker.priceLabel}
    </button>
  );
}

/** Count-only pin for mobile / dense zoom. */
export function PinMarkerView({ marker, selected, onClick }: MarkerProps<PinMarker>) {
  return (
    <button
      type="button"
      className={cx(styles.marker, styles.pin, selected && styles.on)}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={marker.ariaLabel ?? `매물 ${marker.count}건`}
    >
      {formatCount(marker.count)}
    </button>
  );
}

/** Renders the right marker component for a marker model. */
export function MarkerView({ marker, selected, onClick }: MarkerProps<MapMarker>) {
  switch (marker.kind) {
    case 'cluster':
      return <ClusterBubble marker={marker} selected={selected} onClick={onClick} />;
    case 'complex':
      return <ComplexMarkerView marker={marker} selected={selected} onClick={onClick} />;
    case 'price':
      return <PriceMarkerView marker={marker} selected={selected} onClick={onClick} />;
    case 'pin':
      return <PinMarkerView marker={marker} selected={selected} onClick={onClick} />;
  }
}

export interface MapSelectedCardProps {
  title: string;
  /** "해룡면 신대리 · 1,412세대 · 2019년" */
  caption?: string;
  /** Up to two price tiles: 매매 3억 9,000~ / 전세 2억 6,000~. */
  tiles?: readonly { deal: DealKind; label?: string; value: string }[];
  /** CTA: "매물 56건 보기". */
  actionLabel: string;
  actionHref?: string;
  onAction?: () => void;
  linkAs?: LinkAs;
  onClose?: () => void;
  children?: ReactNode;
  className?: string;
}

/** Selected-complex popover card (`.map-pop`). Position it with the page's own CSS. */
export function MapSelectedCard({
  title,
  caption,
  tiles,
  actionLabel,
  actionHref,
  onAction,
  linkAs,
  onClose,
  children,
  className,
}: MapSelectedCardProps) {
  return (
    <section className={cx(styles.pop, className)} aria-label={`${title} 요약`}>
      <div className={styles.popHead}>
        <b className={styles.popTitle}>{title}</b>
        {onClose && (
          <IconButton label="닫기" variant="plain" size={32} onClick={onClose}>
            <Icon name="close" size={18} />
          </IconButton>
        )}
      </div>
      {caption && <p className={styles.popCap}>{caption}</p>}
      {tiles && tiles.length > 0 && (
        <div className={styles.popTiles}>
          {tiles.map((t) => (
            <span key={`${t.deal}-${t.value}`} className={styles.popTile}>
              <em className={styles[t.deal]}>{t.label ?? DEAL_KIND_LABEL[t.deal]}</em>
              <b>{t.value}</b>
            </span>
          ))}
        </div>
      )}
      {children}
      <Button
        variant="ink"
        block
        href={actionHref}
        linkAs={linkAs}
        onClick={onAction}
        iconRight={<Icon name="arrow-right" size={18} />}
      >
        {actionLabel}
      </Button>
    </section>
  );
}

export interface MapBreadcrumbItem {
  label: string;
  onClick?: () => void;
  /** Show a chevron-down (opens a region picker). Default true. */
  hasMenu?: boolean;
}

/** 시 › 읍면동 › 리/단지 breadcrumb chip (`.crumb`). The last item is the current scope. */
export function MapBreadcrumb({
  items,
  className,
}: {
  items: readonly MapBreadcrumbItem[];
  className?: string;
}) {
  return (
    <nav className={cx(styles.crumb, className)} aria-label="지도 위치">
      <Icon name="map-pin" size={18} />
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className={styles.crumbItem}>
            {i > 0 && <Icon name="chevron-right" size={14} />}
            <button
              type="button"
              className={cx(styles.crumbBtn, last && styles.crumbOn)}
              onClick={item.onClick}
              aria-current={last ? 'location' : undefined}
            >
              {item.label}
              {item.hasMenu !== false && <Icon name="chevron-down" size={14} />}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

/** Dark summary pill: "신대리  단지 9 │ 매물 412 │ 평균 1,180만/평" (`.map-sum`). */
export function MapSummary({
  title,
  stats,
  className,
}: {
  title?: string;
  stats: readonly { label: string; value: string; suffix?: string }[];
  className?: string;
}) {
  return (
    <p className={cx(styles.sum, className)}>
      {title}
      {stats.map((s, i) => (
        <span key={s.label} className={styles.crumbItem} style={{ gap: 12 }}>
          {i > 0 && <i aria-hidden="true" />}
          <span>
            {s.label} <b>{s.value}</b>
            {s.suffix}
          </span>
        </span>
      ))}
    </p>
  );
}

/** + / − zoom control. */
export function MapZoomControl({
  onZoomIn,
  onZoomOut,
  canZoomIn = true,
  canZoomOut = true,
  className,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  canZoomIn?: boolean;
  canZoomOut?: boolean;
  className?: string;
}) {
  return (
    <div className={cx(styles.zoom, className)} role="group" aria-label="지도 확대/축소">
      <button type="button" aria-label="확대" onClick={onZoomIn} disabled={!canZoomIn}>
        <Icon name="plus" size={20} />
      </button>
      <button type="button" aria-label="축소" onClick={onZoomOut} disabled={!canZoomOut}>
        <Icon name="minus" size={20} />
      </button>
    </div>
  );
}

/** Square 44px map tool button (내 위치, 레이어 …). */
export function MapToolButton({
  label,
  onClick,
  pressed,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  pressed?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx(styles.tool, className)}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
