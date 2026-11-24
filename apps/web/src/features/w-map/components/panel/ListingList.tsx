'use client';
import { ListingSort } from '@house/shared';
import { Button, EmptyState, ErrorState, Icon, Spinner, cx } from '@house/ui';
import type { InfiniteData, UseInfiniteQueryResult } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import type { AreaUnit } from '@/lib/format';
import type { ListingPage, ListingSummary } from '../../api/schemas';
import type { SortTab } from '../../config/assets';
import { useInfiniteSentinel } from '../../lib/hooks';
import { PanelState } from '../shared';
import {
  ListingCardSkeleton,
  ListingPhotoCard,
  ListingRow,
  ListingRowSkeleton,
} from './ListingItems';
import s from './panel.module.css';

export type ListingListQuery = UseInfiniteQueryResult<InfiniteData<ListingPage>>;

export function flattenPages(data: InfiniteData<ListingPage> | undefined): ListingSummary[] {
  return data?.pages.flatMap((p) => p.items) ?? [];
}

/** Sort tabs (`.lp-bar .tabs`): clicking the active 금액순 / 면적순 again flips its direction. */
export function SortTabs({
  sorts,
  value,
  onChange,
  className,
}: {
  sorts: readonly SortTab[];
  value: ListingSort;
  onChange: (sort: ListingSort) => void;
  className?: string;
}) {
  return (
    <div className={cx(s.sortTabs, className)} role="group" aria-label="정렬">
      {sorts.map((tab) => {
        const on = value === tab.value || value === tab.alt;
        const desc = value === ListingSort.PRICE_DESC || value === ListingSort.AREA_DESC;
        const next = on && tab.alt ? (value === tab.value ? tab.alt : tab.value) : tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            className={cx(s.sortTab, on && s.sortTabOn)}
            aria-pressed={on}
            aria-label={
              on && tab.alt
                ? `${tab.label}, ${desc ? '높은 순' : '낮은 순'}. 누르면 반대로`
                : undefined
            }
            onClick={() => onChange(next)}
          >
            {tab.label}
            {on && tab.alt && <Icon name={desc ? 'arrow-down' : 'arrow-up'} size={14} />}
          </button>
        );
      })}
    </div>
  );
}

export interface ListingListProps {
  query: ListingListQuery;
  layout: 'card' | 'row';
  unit: AreaUnit;
  selectedId?: string | null;
  /** Listings shown elsewhere on the screen (the mobile "선택한 위치" block) — left out here. */
  excludeIds?: ReadonlySet<string>;
  isFavorite: (id: string) => boolean;
  onFavorite: (id: string) => void;
  /** Print the building / location line on rows (non-complex lists). */
  showName?: boolean;
  onResetFilters?: () => void;
  hasActiveFilters?: boolean;
  emptyTitle?: string;
  className?: string;
}

/**
 * Listing list body with every state: skeletons, error + retry, empty (with 필터 초기화),
 * items, and "load more" (sentinel + button fallback).
 */
export function ListingList({
  query,
  layout,
  unit,
  selectedId,
  excludeIds,
  isFavorite,
  onFavorite,
  showName,
  onResetFilters,
  hasActiveFilters,
  emptyTitle = '조건에 맞는 매물이 없어요',
  className,
}: ListingListProps) {
  const all = useMemo(() => flattenPages(query.data), [query.data]);
  const items = useMemo(
    () => (excludeIds?.size ? all.filter((l) => !excludeIds.has(l.id)) : all),
    [all, excludeIds],
  );
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Bring the card of the selected marker into view — once per selection. Later pages of the
  // infinite list must never pull the list back to it (the visitor is browsing further down).
  const selectedRef = useRef<HTMLElement | null>(null);
  const scrolledFor = useRef<string | null>(null);
  const sentinel = useInfiniteSentinel(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    // Paging on: a selected card that only arrives with a later page is not scrolled to.
    scrolledFor.current = selectedId ?? null;
    void fetchNextPage();
  }, !!hasNextPage);
  useEffect(() => {
    if (!selectedId) {
      scrolledFor.current = null;
      return;
    }
    if (scrolledFor.current === selectedId || !selectedRef.current) return;
    scrolledFor.current = selectedId;
    selectedRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedId, items.length]);

  if (query.isPending) {
    return (
      <div className={cx(layout === 'card' ? s.cardGrid : s.rowList, className)} aria-busy="true">
        <span className="sr-only">매물을 불러오는 중</span>
        {Array.from({ length: layout === 'card' ? 4 : 5 }, (_, i) =>
          layout === 'card' ? <ListingCardSkeleton key={i} /> : <ListingRowSkeleton key={i} />,
        )}
      </div>
    );
  }
  if (query.isError && all.length === 0) {
    return (
      <PanelState>
        <ErrorState compact onRetry={() => void query.refetch()} />
      </PanelState>
    );
  }
  if (all.length === 0) {
    return (
      <PanelState>
        <EmptyState
          compact
          title={emptyTitle}
          description={
            hasActiveFilters
              ? '필터를 줄이거나 지도를 옮겨 보세요.'
              : '지도를 옮기거나 축소해서 다른 지역을 살펴보세요.'
          }
          action={
            hasActiveFilters && onResetFilters ? (
              <Button size="sm" variant="secondary" onClick={onResetFilters}>
                필터 초기화
              </Button>
            ) : undefined
          }
        />
      </PanelState>
    );
  }
  const Item = layout === 'card' ? ListingPhotoCard : ListingRow;
  return (
    <>
      <ul className={cx(layout === 'card' ? s.cardGrid : s.rowList, className)}>
        {items.map((l) => (
          <li key={l.id}>
            <Item
              listing={l}
              unit={unit}
              selected={l.id === selectedId}
              favorite={isFavorite(l.id)}
              onFavorite={onFavorite}
              ref={l.id === selectedId ? selectedRef : undefined}
              {...(layout === 'row' ? { showName } : {})}
            />
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <div ref={sentinel} className={s.moreRow}>
          {isFetchingNextPage ? (
            <Spinner />
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                scrolledFor.current = selectedId ?? null;
                void fetchNextPage();
              }}
            >
              매물 더 보기
            </Button>
          )}
        </div>
      )}
      {query.isError && (
        <p className={s.inlineError} role="alert">
          다음 매물을 불러오지 못했어요.{' '}
          <button type="button" className="link" onClick={() => void fetchNextPage()}>
            다시 시도
          </button>
        </p>
      )}
    </>
  );
}
