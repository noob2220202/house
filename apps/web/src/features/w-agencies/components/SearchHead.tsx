'use client';
import { Button, Chip, Icon, Popover, cx } from '@house/ui';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { BRAND } from '@/config/brand';
import type { AgencyRegion } from '../api/schemas';
import { SPECIALTY_OPTIONS, type AgencyFilters } from '../lib/filters';
import styles from './AgencySearch.module.css';
import { formatCount } from '@/lib/format';

export interface SearchHeadProps {
  filters: AgencyFilters;
  onChange: (patch: Partial<AgencyFilters>) => void;
  /** 읍면동 facet; the 지역 filter is hidden until it is known. */
  regions: readonly AgencyRegion[];
  /** All registered offices in the service area. */
  totalOffices: number | null;
  /** "26.11.23" */
  asOf: string;
  /** 지역 filter committed (null = the whole city). */
  onRegionApply: (region: AgencyRegion | null) => void;
}

const PLACEHOLDER = '중개사무소명, 대표명, 주소로 검색';

/** Panel head (`.lp-head`): title + count, search field, specialty chips and the filter row. */
export function SearchHead({
  filters,
  onChange,
  regions,
  totalOffices,
  asOf,
  onRegionApply,
}: SearchHeadProps) {
  const inputId = useId();
  const [text, setText] = useState(filters.q ?? '');
  // Follow the URL (Back/Forward, "조건 초기화").
  useEffect(() => setText(filters.q ?? ''), [filters.q]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (q !== (filters.q ?? '')) onChange({ q: q || null });
  };

  return (
    <div className={styles.head}>
      <div className={styles.title}>
        <h1>중개사무소 찾기</h1>
        {totalOffices !== null && (
          <p className={styles.asOf}>
            {BRAND.region.replace(/시$/, '')} 등록{' '}
            <b className="num">{formatCount(totalOffices)}</b>곳 · {asOf} 기준
          </p>
        )}
      </div>

      <form role="search" className={styles.search} onSubmit={submit}>
        <label className="sr-only" htmlFor={inputId}>
          {PLACEHOLDER}
        </label>
        <Icon name="search" size={18} />
        <input
          id={inputId}
          type="search"
          name="q"
          value={text}
          maxLength={50}
          placeholder={PLACEHOLDER}
          autoComplete="off"
          enterKeyHint="search"
          onChange={(e) => setText(e.target.value)}
        />
        {text && (
          <button
            type="button"
            className={styles.clear}
            aria-label="검색어 지우기"
            onClick={() => {
              setText('');
              if (filters.q) onChange({ q: null });
            }}
          >
            <Icon name="close" size={16} />
          </button>
        )}
      </form>

      <div className={styles.spec} role="group" aria-label="전문분야">
        {SPECIALTY_OPTIONS.map((o) => {
          const selected = (filters.spec ?? '') === o.value;
          return (
            <Chip
              key={o.value || 'all'}
              className={styles.specChip}
              selected={selected}
              iconLeft={selected && o.value ? <Icon name="check" size={16} /> : undefined}
              onClick={() => onChange({ spec: o.value || null })}
            >
              {o.label}
            </Chip>
          );
        })}
      </div>

      <div className={styles.filt} role="group" aria-label="상세 조건">
        {regions.length > 0 && (
          <RegionFilter
            regions={regions}
            value={filters.emd}
            total={totalOffices}
            onApply={(emdCode) => onRegionApply(regions.find((r) => r.emdCode === emdCode) ?? null)}
          />
        )}
        <button
          type="button"
          className={cx(styles.fchip, styles.toggle)}
          aria-pressed={filters.open}
          onClick={() => onChange({ open: !filters.open })}
        >
          <span className={styles.openDot} aria-hidden="true" />
          <span className={styles.v}>지금 영업 중</span>
        </button>
        <button
          type="button"
          className={cx(styles.fchip, styles.toggle)}
          aria-pressed={filters.presale}
          onClick={() => onChange({ presale: !filters.presale })}
        >
          <span className={styles.v}>분양권 취급</span>
        </button>
        {filters.area && (
          <button
            type="button"
            className={cx(styles.fchip, styles.set, styles.areaChip)}
            onClick={() => onChange({ area: null })}
            aria-label="지도 영역 조건 삭제"
          >
            <span className={styles.v}>지도 영역</span>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

interface RegionFilterProps {
  regions: readonly AgencyRegion[];
  value: string | null;
  total: number | null;
  onApply: (emdCode: string | null) => void;
}

/** 지역 filter chip + panel: one 읍면동 or the whole city, committed with 적용. */
function RegionFilter({ regions, value, total, onApply }: RegionFilterProps) {
  const name = useId();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const current = regions.find((r) => r.emdCode === value);
  const all = `${BRAND.region} 전체`;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(value ?? '');
      }}
      label="지역 필터"
      width={320}
      flush
      trigger={(p) => (
        <button type="button" className={cx(styles.fchip, current && styles.set)} {...p}>
          <span className={styles.k}>지역</span>
          <span className={styles.v}>{current?.name ?? all}</span>
          <Icon name="chevron-down" size={16} />
        </button>
      )}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onApply(draft || null);
          setOpen(false);
        }}
      >
        <fieldset className={styles.regionSet}>
          <legend className={styles.regionHead}>지역</legend>
          <div className={styles.regionList}>
            <label className={cx(styles.regionOpt, styles.regionAll)}>
              <input
                type="radio"
                name={name}
                value=""
                checked={draft === ''}
                onChange={() => setDraft('')}
              />
              {all}
              {total !== null && <small>{formatCount(total)}</small>}
            </label>
            {regions.map((r) => (
              <label key={r.emdCode} className={styles.regionOpt}>
                <input
                  type="radio"
                  name={name}
                  value={r.emdCode}
                  checked={draft === r.emdCode}
                  onChange={() => setDraft(r.emdCode)}
                />
                {r.name}
                <small>{formatCount(r.count)}</small>
              </label>
            ))}
          </div>
        </fieldset>
        <div className={styles.regionFoot}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            iconLeft={<Icon name="refresh" size={16} />}
            onClick={() => setDraft('')}
          >
            초기화
          </Button>
          <Button type="submit" size="sm">
            적용
          </Button>
        </div>
      </form>
    </Popover>
  );
}
