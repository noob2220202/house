'use client';
import { DEAL_TYPE_LABEL } from '@house/shared';
import { Chip, FilterDropdown, Icon, SegmentedControl, cx } from '@house/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapAssetSlug } from '@/config/nav';
import { formatDateShort, type AreaUnit } from '@/lib/format';
import { defaultFilters } from '@/lib/map';
import { ROOM_TYPE_LABEL, RoomType } from '../../api/schemas';
import type { AssetConfig, FilterKind } from '../../config/assets';
import {
  FILTER_SPEC,
  KIND_LABEL,
  QUICK_OPTIONS,
  chipLabel,
  hasOptions,
  isKindActive,
  keysOf,
  pickKeys,
  toggleOptions,
  type MapFilters,
} from '../../lib/filters';
import { FilterSection } from './sections';
import s from './filters.module.css';

export interface FilterControlsProps {
  asset: AssetConfig;
  filters: MapFilters;
  unit: AreaUnit;
  onChange: (patch: Partial<MapFilters>) => void;
  categoryHref: (slug: MapAssetSlug) => string;
  /** Offer the 평 / ㎡ switch inside the area filter (bars without the unit toggle). */
  onUnitChange?: (unit: AreaUnit) => void;
}

const DEFAULTS = defaultFilters(FILTER_SPEC);
const POPOVER_WIDTH: Partial<Record<FilterKind, number>> = {
  category: 260,
  deal: 300,
  rooms: 340,
  baths: 300,
  floor: 280,
  direction: 360,
  more: 380,
  options: 360,
  landZone: 340,
};

/** Filter chip + popover: edits a draft, commits the control's keys on 적용. */
export function FilterPopover({
  kind,
  asset,
  filters,
  unit,
  onChange,
  categoryHref,
  onUnitChange,
}: FilterControlsProps & { kind: FilterKind }) {
  const [draft, setDraft] = useState(filters);
  const thisYear = new Date().getFullYear();
  const keys = keysOf(kind, asset);
  const section = { asset, unit, thisYear, categoryHref, onUnitChange };
  const patch = (p: Partial<MapFilters>) => setDraft((d) => ({ ...d, ...p }));
  return (
    <FilterDropdown
      field={KIND_LABEL[kind]}
      valueLabel={chipLabel(kind, asset, filters, unit, thisYear)}
      active={kind === 'category' || isKindActive(kind, asset, filters)}
      title={kind === 'area' ? asset.areaLabel : KIND_LABEL[kind]}
      width={POPOVER_WIDTH[kind] ?? 340}
      onOpen={() => setDraft(filters)}
      onReset={() => patch(pickKeys(DEFAULTS, keys))}
      onApply={() => onChange(pickKeys(draft, keys))}
    >
      {kind === 'more' ? (
        <div className={s.stack}>
          {asset.more.map((k) => (
            <FilterSection key={k} kind={k} titled value={draft} onChange={patch} {...section} />
          ))}
        </div>
      ) : (
        <FilterSection kind={kind} value={draft} onChange={patch} {...section} />
      )}
    </FilterDropdown>
  );
}

/**
 * Inline multi-select on a soft track (OneRoom design `.fg`): every option on = no filter.
 * Changes apply immediately.
 */
function InlineGroup({
  label,
  short,
  options,
  selected,
  onChange,
}: {
  label: string;
  short: string;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
}) {
  const all = options.map((o) => o.value);
  const effective = selected.length ? all.filter((v) => selected.includes(v)) : all;
  const toggle = (value: string) => {
    const next = effective.includes(value)
      ? effective.filter((v) => v !== value)
      : all.filter((v) => v === value || effective.includes(v));
    // Turning the last one off, or everything on, both mean "전체".
    onChange(next.length === 0 || next.length === all.length ? [] : next);
  };
  return (
    <div className={s.fg} role="group" aria-label={label}>
      <span className={s.fgKey} aria-hidden="true">
        {short}
      </span>
      {options.map((o) => {
        const on = effective.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            className={cx(s.fgBtn, on && s.fgOn)}
            aria-pressed={on}
            onClick={() => toggle(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const INLINE_ROOM_TYPES = [RoomType.ONE_ROOM, RoomType.ONE_HALF_ROOM, RoomType.TWO_ROOM] as const;

/** 풀옵션 / 주차 / 엘리베이터 / 반려동물 toggle chips (`.ochip`). */
export function QuickOptionChips({
  filters,
  onChange,
  className,
}: Pick<FilterControlsProps, 'filters' | 'onChange'> & { className?: string }) {
  return (
    <>
      {QUICK_OPTIONS.map((q) => {
        const on = hasOptions(filters.options, q.options);
        return (
          <Chip
            key={q.key}
            className={cx(s.ochip, on && s.ochipOn, className)}
            selected={on}
            iconLeft={<Icon name={on ? 'check' : 'plus'} size={16} />}
            onClick={() => onChange({ options: toggleOptions(filters.options, q.options) })}
          >
            {q.label}
          </Chip>
        );
      })}
    </>
  );
}

/** One control of the bar: inline group on desktop for 원룸 (방 / 거래), popover chip otherwise. */
export function FilterControl({
  kind,
  inline,
  ...props
}: FilterControlsProps & { kind: FilterKind; inline?: boolean }) {
  const { asset, filters, onChange } = props;
  if (kind === 'quickOptions') return <QuickOptionChips filters={filters} onChange={onChange} />;
  if (inline && kind === 'roomType') {
    return (
      <InlineGroup
        label="방 종류"
        short="방"
        options={INLINE_ROOM_TYPES.map((value) => ({ value, label: ROOM_TYPE_LABEL[value] }))}
        selected={filters.roomTypes}
        onChange={(roomTypes) => onChange({ roomTypes })}
      />
    );
  }
  if (inline && kind === 'deal' && asset.slug === 'oneroom') {
    return (
      <InlineGroup
        label="거래종류"
        short="거래"
        options={asset.dealTypes.map((value) => ({ value, label: DEAL_TYPE_LABEL[value] }))}
        selected={filters.dealTypes}
        onChange={(dealTypes) => onChange({ dealTypes })}
      />
    );
  }
  return <FilterPopover kind={kind} {...props} />;
}

export interface FilterBarProps extends FilterControlsProps {
  onReset: () => void;
  onUnitChange: (unit: AreaUnit) => void;
  hasActive: boolean;
}

/**
 * Which ends of a horizontal scroller hide content, kept in sync with scrolling and resizing.
 * Drives the edge fades and the scroll buttons of the filter strip.
 */
function useScrollEdges() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });
  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((e) => (e.start === start && e.end === end ? e : { start, end }));
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);
    el.addEventListener('scroll', measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', measure);
    };
  }, [measure]);
  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' });
  };
  return { ref, edges, scrollBy };
}

/**
 * Desktop filter bar (MapApt / OneRoom designs): chips, 초기화, 시세 기준일, 평/㎡. When the chips do
 * not fit (small laptops, tablets) only the chip strip scrolls — with edge fades and arrow buttons —
 * while 초기화 and the unit switch stay in place.
 */
export function FilterBar({ onReset, onUnitChange, hasActive, ...props }: FilterBarProps) {
  const { asset, unit } = props;
  const quickAt = asset.bar.indexOf('quickOptions');
  // The 원룸 bar is full (OneRoom design has no bar end): its unit switch lives in the 면적 filter.
  const unitInBar = asset.slug !== 'oneroom';
  const strip = useScrollEdges();
  return (
    <div className={s.bar} role="group" aria-label="매물 필터">
      <div
        className={s.barStrip}
        data-more-start={strip.edges.start || undefined}
        data-more-end={strip.edges.end || undefined}
      >
        <div ref={strip.ref} className={s.barScroll}>
          {asset.bar.map((kind, i) => (
            <span key={kind} className={s.barItem}>
              {i === quickAt && <span className={s.sep} aria-hidden="true" />}
              <FilterControl
                kind={kind}
                inline
                {...props}
                onUnitChange={unitInBar ? undefined : onUnitChange}
              />
            </span>
          ))}
        </div>
        {/* Pointer convenience only: keyboard focus scrolls the strip by itself. */}
        {strip.edges.start && (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={cx(s.barArrow, s.barArrowStart)}
            onClick={() => strip.scrollBy(-1)}
          >
            <Icon name="chevron-left" size={18} />
          </button>
        )}
        {strip.edges.end && (
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={cx(s.barArrow, s.barArrowEnd)}
            onClick={() => strip.scrollBy(1)}
          >
            <Icon name="chevron-right" size={18} />
          </button>
        )}
      </div>
      <button type="button" className={s.reset} onClick={onReset} disabled={!hasActive}>
        <Icon name="refresh" size={18} />
        {asset.slug === 'oneroom' ? '필터 초기화' : '초기화'}
      </button>
      {unitInBar && (
        <div className={s.barEnd}>
          {asset.listMode === 'complex' && (
            <>
              <span className={s.barNote}>시세 기준 {formatDateShort(new Date())}</span>
              <span className={s.sepSm} aria-hidden="true" />
            </>
          )}
          <SegmentedControl
            label="면적 단위"
            size="sm"
            value={unit}
            onChange={onUnitChange}
            options={[
              { value: 'pyeong', label: '평' },
              { value: 'sqm', label: '㎡' },
            ]}
          />
        </div>
      )}
    </div>
  );
}
