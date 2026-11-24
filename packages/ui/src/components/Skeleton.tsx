import type { CSSProperties } from 'react';
import styles from './Skeleton.module.css';
import { cx } from '../lib/cx';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Border radius token or px. */
  radius?: number | string;
  /** Circle (avatar) shape. */
  circle?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Shimmering placeholder block. Reserve the final size to avoid layout shift. */
export function Skeleton({
  width = '100%',
  height = 16,
  radius,
  circle,
  className,
  style,
}: SkeletonProps) {
  return (
    <span
      className={cx(styles.sk, className)}
      style={{ width, height, borderRadius: circle ? '50%' : radius, ...style }}
      aria-hidden="true"
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 3, className }: SkeletonTextProps) {
  return (
    <span className={cx(styles.text, className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={14} width={i === lines - 1 ? '60%' : '100%'} />
      ))}
    </span>
  );
}

/** Skeleton with the exact footprint of a ListingCard. */
export function ListingCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cx(styles.card, className)} aria-hidden="true">
      <Skeleton height="auto" radius={0} style={{ aspectRatio: '16 / 10' }} />
      <div className={styles.cardBody}>
        <Skeleton width={40} height={14} />
        <Skeleton width="60%" height={30} />
        <Skeleton width="80%" height={16} />
        <Skeleton width="50%" height={14} />
      </div>
    </div>
  );
}

/** Wrap a loading region: announces "불러오는 중" once to assistive tech. */
export function LoadingRegion({
  label = '불러오는 중',
  children,
  className,
}: {
  label?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {children}
    </div>
  );
}
