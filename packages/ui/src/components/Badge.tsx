import type { ReactNode } from 'react';
import styles from './Badge.module.css';
import { cx } from '../lib/cx';
import { DEAL_KIND_LABEL, type DealKind } from '../lib/types';
import { Icon } from '../icons/Icon';

export interface BadgeProps {
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warn' | 'danger' | 'accent' | 'ink';
  className?: string;
}

/** Small neutral label (`.badge`). */
export function Badge({ children, tone = 'neutral', className }: BadgeProps) {
  return (
    <span className={cx(styles.badge, tone !== 'neutral' && styles[tone], className)}>
      {children}
    </span>
  );
}

export interface DealBadgeProps {
  deal: DealKind;
  /** Solid fill (map / emphasis) instead of the soft tint (lists). */
  solid?: boolean;
  /** Override the label (e.g. "분양"). */
  children?: ReactNode;
  className?: string;
}

/** Deal-type tag: 매매 / 전세 / 월세 / 분양권. Colour always comes with its text label. */
export function DealBadge({ deal, solid, children, className }: DealBadgeProps) {
  return (
    <span className={cx(styles.deal, styles[deal], solid && styles.solid, className)}>
      {children ?? DEAL_KIND_LABEL[deal]}
    </span>
  );
}

export interface DealLabelProps {
  deal: DealKind;
  children?: ReactNode;
  className?: string;
}

/** Plain coloured deal-type caption used above prices on cards (12px/800). */
export function DealLabel({ deal, children, className }: DealLabelProps) {
  return (
    <span className={cx(styles.dealText, styles[`t_${deal}`], className)}>
      {children ?? DEAL_KIND_LABEL[deal]}
    </span>
  );
}

export interface PremiumBadgeProps {
  /** 분양권 premium in 만원; positive → "P +2,700" (red), negative → "P -1,200" (blue). */
  amount: number;
  className?: string;
}

export function PremiumBadge({ amount, className }: PremiumBadgeProps) {
  const up = amount >= 0;
  const text = `P ${up ? '+' : '-'}${Math.abs(amount).toLocaleString('ko-KR')}`;
  return (
    <span
      className={cx(styles.prem, up ? styles.up : styles.down, className)}
      aria-label={`프리미엄 ${up ? '플러스' : '마이너스'} ${Math.abs(amount).toLocaleString('ko-KR')}만원`}
    >
      {text}
    </span>
  );
}

export interface RankDeltaProps {
  /** Rank change: positive = moved up (red ▲), negative = moved down (blue ▼), 0 = flat, 'new' = NEW. */
  delta: number | 'new';
  className?: string;
}

export function RankDelta({ delta, className }: RankDeltaProps) {
  if (delta === 'new')
    return <span className={cx(styles.delta, styles.deltaUp, className)}>NEW</span>;
  if (delta === 0)
    return (
      <span className={cx(styles.delta, styles.deltaFlat, className)} aria-label="순위 변동 없음">
        –
      </span>
    );
  const up = delta > 0;
  return (
    <span
      className={cx(styles.delta, up ? styles.deltaUp : styles.deltaDown, className)}
      aria-label={`${Math.abs(delta)}계단 ${up ? '상승' : '하락'}`}
    >
      <span aria-hidden="true">{up ? '▲' : '▼'}</span>
      {Math.abs(delta)}
    </span>
  );
}

export interface AdBadgeProps {
  onDark?: boolean;
  className?: string;
}

/** Mandatory "AD" label on every paid placement. */
export function AdBadge({ onDark, className }: AdBadgeProps) {
  return (
    <span className={cx(styles.ad, onDark && styles.adDark, className)} aria-label="광고">
      AD
    </span>
  );
}

export interface VerifiedBadgeProps {
  /** Display date, e.g. "26.11.22". */
  date?: string;
  children?: ReactNode;
  className?: string;
}

/** 실매물 확인 mark with the verification date. */
export function VerifiedBadge({ date, children, className }: VerifiedBadgeProps) {
  return (
    <span className={cx(styles.verified, className)}>
      <Icon name="check-circle" size={16} />
      {children ?? `실매물 확인${date ? ` ${date}` : ''}`}
    </span>
  );
}

export interface BrokersBadgeProps {
  /** Number of co-brokering offices. */
  count: number;
  /** Light variant for use on white (default is dark, for photos). */
  light?: boolean;
  className?: string;
}

/** "중개사 N곳" — co-brokerage count. */
export function BrokersBadge({ count, light, className }: BrokersBadgeProps) {
  return (
    <span className={cx(styles.brokers, light && styles.brokersLight, className)}>
      <Icon name="users" size={14} />
      중개사 {count.toLocaleString('ko-KR')}곳
    </span>
  );
}

export type StatusTone = 'live' | 'scheduled' | 'review' | 'ended' | 'rejected';

export interface StatusPillProps {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
}

/** Status pill with dot: 게시중 / 예약 / 검수 대기 / 종료 / 반려. */
export function StatusPill({ tone, children, className }: StatusPillProps) {
  return <span className={cx(styles.status, styles[tone], className)}>{children}</span>;
}

export interface TagProps {
  children: ReactNode;
  icon?: ReactNode;
  /** `spec` = grey pill for specs (2480 × 440); `accent` = reed text tag (전문 분야). */
  variant?: 'spec' | 'accent';
  className?: string;
}

/** Small pill tag for specs and specialties. */
export function Tag({ children, icon, variant = 'spec', className }: TagProps) {
  return (
    <span className={cx(variant === 'spec' ? styles.spec : styles.tagAccent, className)}>
      {icon}
      {children}
    </span>
  );
}
