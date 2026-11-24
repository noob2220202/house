'use client';
import { DealType, type ListingSort } from '@house/shared';
import { Icon, Popover, SegmentedControl } from '@house/ui';
import type { KeyboardEvent } from 'react';
import { formatCount, type AreaUnit } from '@/lib/format';
import type { ComplexListingSummary } from '../api/schemas';
import { SORT_OPTIONS } from '../lib/filters';
import styles from './panel.module.css';

const DEAL_CAPTIONS: readonly { deal: DealType; label: string; className: string }[] = [
  { deal: DealType.PRESALE, label: '분양권', className: 't-presale' },
  { deal: DealType.SALE, label: '매매', className: 't-sale' },
  { deal: DealType.JEONSE, label: '전세', className: 't-jeonse' },
  { deal: DealType.MONTHLY, label: '월세', className: 't-monthly' },
];

const UNIT_OPTIONS = [
  { value: 'pyeong', label: '평' },
  { value: 'sqm', label: '㎡' },
] as const;

/**
 * Sort choices as a radio group (APG pattern): one tab stop (the checked option, focused when the
 * popover opens), Arrow keys / Home / End move focus and check, Enter / Space / click choose and close.
 */
function SortOptions({
  value,
  onChange,
  onDone,
}: {
  value: ListingSort;
  onChange: (sort: ListingSort) => void;
  onDone: () => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const radios = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    const i = radios.indexOf(document.activeElement as HTMLButtonElement);
    const last = radios.length - 1;
    const next =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? i >= last
          ? 0
          : i + 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? i <= 0
            ? last
            : i - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    const option = SORT_OPTIONS[next];
    radios[next]?.focus();
    if (option) onChange(option.value);
  };
  return (
    <div className={styles.sortMenu} role="radiogroup" aria-label="정렬 기준" onKeyDown={onKeyDown}>
      {SORT_OPTIONS.map((o) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-autofocus={checked ? '' : undefined}
            className={styles.sortItem}
            onClick={() => {
              onChange(o.value);
              onDone();
            }}
          >
            {o.label}
            {checked && <Icon name="check" size={16} />}
          </button>
        );
      })}
    </div>
  );
}

export interface PanelSummaryBarProps {
  /** Listings matching the current filters (undefined while the first page loads). */
  total: number | undefined;
  summary: ComplexListingSummary | undefined;
  unit: AreaUnit;
  onUnitChange: (unit: AreaUnit) => void;
  sort: ListingSort;
  onSortChange: (sort: ListingSort) => void;
}

/** "매물 56 · 매매 38 · 전세 12 · 월세 6" + 평/㎡ toggle + sort menu. */
export function PanelSummaryBar({
  total,
  summary,
  unit,
  onUnitChange,
  sort,
  onSortChange,
}: PanelSummaryBarProps) {
  const counts = new Map(summary?.byDealType.map((d) => [d.dealType, d.count]));
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? SORT_OPTIONS[0]!.label;
  return (
    <div className={styles.sum}>
      <p className={styles.sumC} aria-live="polite">
        <b className={styles.sumTotal}>
          매물 <span>{total === undefined ? '–' : formatCount(total)}</span>
        </b>
        {DEAL_CAPTIONS.filter((d) => (counts.get(d.deal) ?? 0) > 0).map((d) => (
          <span key={d.deal}>
            <em className={d.className}>{d.label}</em>
            <b>{formatCount(counts.get(d.deal) ?? 0)}</b>
          </span>
        ))}
      </p>
      <div className={styles.sumR}>
        <SegmentedControl
          label="면적 단위"
          size="sm"
          tone="ink"
          className={styles.unitSeg}
          options={UNIT_OPTIONS}
          value={unit}
          onChange={onUnitChange}
        />
        <Popover
          label="정렬"
          placement="bottom-end"
          flush
          trigger={(props) => (
            <button type="button" className={styles.sortb} {...props}>
              <Icon name="sort" size={16} />
              {sortLabel}
            </button>
          )}
        >
          {(close) => <SortOptions value={sort} onChange={onSortChange} onDone={close} />}
        </Popover>
      </div>
    </div>
  );
}
