import { Button, Callout, EmptyState, ErrorState, LoadingRegion, Skeleton, cx } from '@house/ui';
import Link from 'next/link';
import { Fragment, type ReactNode } from 'react';
import { ApiError, errorMessage } from '@/lib/api';
import s from './ui.module.css';

// ---------- notices ---------------------------------------------------------------------------

/**
 * Personal-data notice: reads of member / applicant data are written to the audit log by the API.
 * Shown on every screen that renders unmasked personal data.
 */
export function AuditNotice({ subject = '개인정보' }: { subject?: string }) {
  return (
    <Callout size="sm" icon="shield">
      <strong>열람 기록이 남는 화면이에요.</strong> 이 화면의 {subject} 조회와 처리 내역은 관리자
      계정과 함께 작업 기록에 저장됩니다. 업무 목적 외 열람·복사·외부 공유는 금지돼요.
    </Callout>
  );
}

// ---------- page frame ------------------------------------------------------------------------

export interface DetailHeroProps {
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Status pills / badges next to the title. */
  badges?: ReactNode;
  /** Meta chips under the title — pass <span>s. */
  meta?: ReactNode;
  /** Right side: links / secondary actions. */
  aside?: ReactNode;
}

/** Entity header card of a detail page (name, status, key facts). */
export function DetailHero({ icon, eyebrow, title, badges, meta, aside }: DetailHeroProps) {
  return (
    <header className={s.hero}>
      <div className={s.heroMain}>
        {icon && <span className={s.heroIcon}>{icon}</span>}
        <div className={s.heroText}>
          {eyebrow && <span className={s.heroEyebrow}>{eyebrow}</span>}
          <div className={s.heroTitleRow}>
            {/* The topbar holds the page's <h1> ("중개사무소 심사"); the entity name is the first h2. */}
            <h2 className={s.heroTitle}>{title}</h2>
            {badges}
          </div>
          {meta && <div className={s.heroMeta}>{meta}</div>}
        </div>
      </div>
      {aside && <div className={s.heroAside}>{aside}</div>}
    </header>
  );
}

/** Two-column detail body: main panels + a sticky decision column (stacks first on narrow screens). */
export function DetailGrid({ main, side }: { main: ReactNode; side: ReactNode }) {
  return (
    <div className={s.grid}>
      <div className={s.col}>{main}</div>
      <div className={cx(s.col, s.colSide, s.side)}>{side}</div>
    </div>
  );
}

// ---------- definition list -------------------------------------------------------------------

export interface InfoItem {
  label: string;
  value: ReactNode;
  /** Span both columns. */
  wide?: boolean;
}

const isBlank = (v: ReactNode) => v === null || v === undefined || v === '' || v === false;

/** Label / value grid (`<dl>`), two columns on desktop. Empty values render as "–". */
export function InfoList({ items, columns = 2 }: { items: readonly InfoItem[]; columns?: 1 | 2 }) {
  // Mark first/last visual rows so the outer dividers can be dropped.
  let col = 0;
  const rows: number[] = [];
  let row = 0;
  for (const item of items) {
    if (item.wide || columns === 1) {
      if (col !== 0) row += 1;
      rows.push(row);
      row += 1;
      col = 0;
    } else {
      rows.push(row);
      col = (col + 1) % 2;
      if (col === 0) row += 1;
    }
  }
  const lastRow = rows.length > 0 ? Math.max(...rows) : 0;
  return (
    <dl className={cx(s.info, columns === 1 && s.infoOne)}>
      {items.map((item, i) => (
        <div
          key={item.label}
          className={cx(
            s.infoRow,
            (item.wide || columns === 1) && s.infoWide,
            rows[i] === 0 && s.infoFirst,
            rows[i] === lastRow && s.infoLast,
          )}
        >
          <dt>{item.label}</dt>
          <dd>{isBlank(item.value) ? <span className={s.mutedText}>–</span> : item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---------- mini stats ------------------------------------------------------------------------

export function MiniStats({
  items,
}: {
  items: readonly { label: string; value: ReactNode; unit?: string }[];
}) {
  return (
    <div className={cx(s.stats, items.length === 4 && s.statsQuad)}>
      {items.map((it) => (
        <div key={it.label} className={s.stat}>
          <span className={s.statLabel}>{it.label}</span>
          <span className={s.statValue}>
            {it.value}
            {it.unit && <small>{it.unit}</small>}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------- timeline --------------------------------------------------------------------------

export interface TimelineItem {
  id: string;
  title: ReactNode;
  /** "정다은 · 2026.11.23 14:20" */
  meta?: ReactNode;
  note?: ReactNode;
  tone?: 'default' | 'brand' | 'success' | 'danger' | 'warn';
}

/** Vertical history list, newest first. */
export function Timeline({ items, label }: { items: readonly TimelineItem[]; label: string }) {
  if (items.length === 0) return <p className={s.actionHint}>아직 기록이 없어요.</p>;
  return (
    <ol className={s.timeline} aria-label={label}>
      {items.map((it) => (
        <li
          key={it.id}
          className={cx(
            s.tlItem,
            it.tone === 'brand' && s.tlBrand,
            it.tone === 'success' && s.tlSuccess,
            it.tone === 'danger' && s.tlDanger,
            it.tone === 'warn' && s.tlWarn,
          )}
        >
          <span className={s.tlTitle}>{it.title}</span>
          {it.meta && <span className={s.tlMeta}>{it.meta}</span>}
          {it.note && <span className={s.tlNote}>{it.note}</span>}
        </li>
      ))}
    </ol>
  );
}

/** Joins the non-empty parts with " · ". */
export function Dots({ parts }: { parts: readonly ReactNode[] }) {
  const shown = parts.filter((p) => !isBlank(p));
  return (
    <>
      {shown.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && ' · '}
          {p}
        </Fragment>
      ))}
    </>
  );
}

// ---------- loading / error -------------------------------------------------------------------

export function DetailSkeleton() {
  return (
    <LoadingRegion className={s.detail}>
      <Skeleton height={20} width={96} />
      <Skeleton height={104} radius={16} />
      <div className={s.skeletonGrid}>
        <div className={s.col}>
          <Skeleton height={280} radius={16} />
          <Skeleton height={220} radius={16} />
        </div>
        <div className={s.col}>
          <Skeleton height={220} radius={16} />
          <Skeleton height={180} radius={16} />
        </div>
      </div>
    </LoadingRegion>
  );
}

export interface DetailErrorProps {
  error: unknown;
  onRetry: () => void;
  backHref: string;
  backLabel: string;
  /** What was not found, e.g. "중개사무소". */
  subject: string;
}

/** 404 → "찾을 수 없어요" with a way back; anything else → retryable error. */
export function DetailError({ error, onRetry, backHref, backLabel, subject }: DetailErrorProps) {
  const back = (
    <Button href={backHref} linkAs={Link} variant="secondary" size="sm">
      {backLabel}
    </Button>
  );
  if (error instanceof ApiError && error.isNotFound) {
    return (
      <EmptyState
        icon="search"
        title={`${subject} 정보를 찾을 수 없어요`}
        description="삭제되었거나 주소가 잘못되었을 수 있어요."
        action={back}
      />
    );
  }
  return (
    <ErrorState
      title={`${subject} 정보를 불러오지 못했어요`}
      description={errorMessage(error)}
      code={error instanceof ApiError ? (error.requestId ?? error.code) : undefined}
      onRetry={onRetry}
      action={back}
    />
  );
}
