'use client';
import { Icon, cx } from '@house/ui';
import { useId } from 'react';
import type { AreaUnit } from '@/lib/format';
import type { ComplexAreaType, ComplexListingSummary } from '../api/schemas';
import {
  BATH_OPTIONS,
  DIRECTION_OPTIONS,
  FLOOR_OPTIONS,
  ROOM_OPTIONS,
  activeFilterCount,
  areaOptions,
  bandLabel,
  clearedFilters,
  dealOptions,
  priceOptions,
  type Option,
  type PanelFilterValues,
} from '../lib/filters';
import styles from './panel.module.css';

interface FilterSelectProps {
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
  /** Label of a current value that is not among `options` (e.g. from a shared URL). */
  unknownLabel?: (value: string) => string;
}

/** Compact labelled native select ("거래 전체 ⌄") — native control = keyboard + mobile pickers for free. */
function FilterSelect({ label, value, options, onChange, unknownLabel }: FilterSelectProps) {
  const id = useId();
  // Keep an out-of-list value selectable so a shared URL never renders a blank control.
  const known = value === '' || options.some((o) => o.value === value);
  return (
    <label className={cx(styles.fsel, value !== '' && styles.set)} htmlFor={id}>
      <span className={styles.k}>{label}</span>
      {/* Explicit name: a wrapping label would otherwise add the selected value to it ("거래 전체"). */}
      <select id={id} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">전체</option>
        {!known && <option value={value}>{unknownLabel ? unknownLabel(value) : value}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={16} />
    </label>
  );
}

export interface PanelFilterBarProps {
  filters: PanelFilterValues;
  onChange: (patch: Partial<PanelFilterValues>) => void;
  areaTypes: readonly ComplexAreaType[];
  summary: ComplexListingSummary | undefined;
  unit: AreaUnit;
}

/** Horizontal filter strip: 거래 · 면적 · 금액 · 방향 · 동 · 층 · 방 · 욕실 (+ 초기화 when any is set). */
export function PanelFilterBar({
  filters,
  onChange,
  areaTypes,
  summary,
  unit,
}: PanelFilterBarProps) {
  const active = activeFilterCount(filters);
  const dongs = (summary?.dongs ?? []).map((d) => ({ value: d, label: d }));
  return (
    <div className={styles.filter} role="group" aria-label="매물 조건">
      <FilterSelect
        label="거래"
        value={filters['c-deal'] ?? ''}
        options={dealOptions(summary)}
        // 금액 bands depend on the deal type → reset them together.
        onChange={(v) => onChange({ 'c-deal': v || null, 'c-price': null })}
      />
      <FilterSelect
        label="면적"
        value={filters['c-area'] ?? ''}
        options={areaOptions(areaTypes, unit)}
        onChange={(v) => onChange({ 'c-area': v || null })}
      />
      <FilterSelect
        label="금액"
        value={filters['c-price'] ?? ''}
        options={priceOptions(summary, filters['c-deal'])}
        unknownLabel={bandLabel}
        onChange={(v) => onChange({ 'c-price': v || null })}
      />
      <FilterSelect
        label="방향"
        value={filters['c-dir'] ?? ''}
        options={DIRECTION_OPTIONS}
        onChange={(v) => onChange({ 'c-dir': v || null })}
      />
      <FilterSelect
        label="동"
        value={filters['c-dong'] ?? ''}
        options={dongs}
        onChange={(v) => onChange({ 'c-dong': v || null })}
      />
      <FilterSelect
        label="층"
        value={filters['c-floor'] ?? ''}
        options={FLOOR_OPTIONS}
        onChange={(v) => onChange({ 'c-floor': v || null })}
      />
      <FilterSelect
        label="방"
        value={filters['c-rooms'] ? String(filters['c-rooms']) : ''}
        options={ROOM_OPTIONS}
        onChange={(v) => onChange({ 'c-rooms': v ? Number(v) : null })}
      />
      <FilterSelect
        label="욕실"
        value={filters['c-baths'] ? String(filters['c-baths']) : ''}
        options={BATH_OPTIONS}
        onChange={(v) => onChange({ 'c-baths': v ? Number(v) : null })}
      />
      {active > 0 && (
        <button type="button" className={styles.reset} onClick={() => onChange(clearedFilters())}>
          <Icon name="refresh" size={16} />
          초기화
        </button>
      )}
    </div>
  );
}
