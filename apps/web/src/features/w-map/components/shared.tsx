'use client';
import {
  Icon,
  PhotoPlaceholder,
  Popover,
  SearchField,
  cx,
  type ComboboxOption,
  type PhotoKind,
  useDebouncedValue,
} from '@house/ui';
import Image from 'next/image';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFavoriteActions } from '@/lib/favorites/useFavorite';
import { useSuggest } from '../api/queries';
import type { SuggestItem } from '../api/schemas';
import s from './shared.module.css';

/** Cover photo via next/image, or the branded placeholder when the listing has none. */
export function CoverPhoto({
  url,
  alt,
  sizes,
  placeholder,
}: {
  url: string | null | undefined;
  alt: string;
  sizes: string;
  placeholder: PhotoKind;
}) {
  if (!url) return <PhotoPlaceholder kind={placeholder} />;
  return <Image src={url} alt={alt} fill sizes={sizes} style={{ objectFit: 'cover' }} />;
}

/**
 * Favourite state + toggle for complexes or listings — the shared favourites module (one id cache,
 * one auth gate, one toast style for every heart on the site).
 */
export const useFavorite = (kind: 'complexes' | 'listings') => useFavoriteActions(kind);

const SUGGEST_ICON: Record<string, 'map-pin' | 'building' | 'store'> = {
  REGION: 'map-pin',
  COMPLEX: 'building',
  AGENCY: 'store',
};

/** Pill search field with region / complex autocomplete (`GET /search/suggest`). */
export function SearchBox({
  label,
  placeholder,
  types,
  onPick,
  resetSignal,
  className,
}: {
  label: string;
  placeholder: string;
  /** Suggestion types this page can act on. */
  types: readonly string[];
  onPick: (item: SuggestItem) => void;
  /**
   * Bump to empty the field: the page does so when the map no longer shows the picked place
   * (panned away, selection closed, browser Back), so the field never names a place that is not
   * on screen.
   */
  resetSignal?: number;
  className?: string;
}) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (resetSignal) setValue('');
  }, [resetSignal]);
  const term = useDebouncedValue(value, 180);
  const suggest = useSuggest(term);
  const items = useMemo(
    () => (term.trim() ? (suggest.data?.items ?? []).filter((i) => types.includes(i.type)) : []),
    [suggest.data, term, types],
  );
  const options: ComboboxOption[] = items.map((i) => ({
    value: `${i.type}:${i.id}`,
    label: i.label,
    description: i.description ?? undefined,
    leading: <Icon name={SUGGEST_ICON[i.type] ?? 'search'} size={18} />,
  }));
  const pick = (key: string) => {
    const item = items.find((i) => `${i.type}:${i.id}` === key);
    if (!item) return;
    setValue(item.label);
    onPick(item);
  };
  return (
    <SearchField
      variant="pill"
      className={className}
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={setValue}
      options={options}
      loading={suggest.isFetching && term.trim().length > 0}
      emptyText={
        term.trim() ? '검색 결과가 없어요. 동 이름이나 단지명을 확인해 주세요.' : undefined
      }
      onSelect={(o) => pick(o.value)}
      onSubmit={() => {
        const first = options[0];
        if (first) pick(first.value);
      }}
    />
  );
}

/** Small sort button + menu (`.sortb`). */
export function SortMenu<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Popover
      label={label}
      placement="bottom-end"
      flush
      trigger={(p) => (
        <button type="button" className={cx(s.sortBtn, className)} {...p}>
          <Icon name="sort" size={16} />
          {current?.label}
        </button>
      )}
    >
      {(close) => (
        <ul className={s.menu}>
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                aria-pressed={o.value === value}
                className={cx(s.menuItem, o.value === value && s.menuOn)}
                onClick={() => {
                  onChange(o.value);
                  close();
                }}
              >
                {o.label}
                {o.value === value && <Icon name="check" size={16} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

/** Icon heart button used on cards and popovers. */
export function HeartButton({
  on,
  label,
  onClick,
  className,
  size = 20,
}: {
  on: boolean;
  label: string;
  onClick: () => void;
  className?: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      className={cx(s.heart, on && s.heartOn, className)}
      aria-pressed={on}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      <Icon name="heart" size={size} />
    </button>
  );
}

/** Centered block for loading / empty / error content inside a panel. */
export function PanelState({ children }: { children: ReactNode }) {
  return <div className={s.state}>{children}</div>;
}
