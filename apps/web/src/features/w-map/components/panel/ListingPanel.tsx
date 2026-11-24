'use client';
import type { ListingSort } from '@house/shared';
import { Icon, SegmentedControl, Switch } from '@house/ui';
import { useMemo } from 'react';
import type { AreaUnit } from '@/lib/format';
import type { AssetConfig } from '../../config/assets';
import { shortEmd } from '../../lib/listing';
import { ListingList, SortTabs, flattenPages, type ListingListQuery } from './ListingList';
import s from './panel.module.css';

export interface ListingPanelProps {
  asset: AssetConfig;
  query: ListingListQuery;
  sort: ListingSort;
  onSortChange: (sort: ListingSort) => void;
  view: 'card' | 'list';
  /** Omit to hide the card / list switch (panels too narrow for the card grid show rows only). */
  onViewChange?: (view: 'card' | 'list') => void;
  unit: AreaUnit;
  verifiedOnly: boolean;
  onVerifiedOnlyChange: (on: boolean) => void;
  selectedId: string | null;
  isFavorite: (id: string) => boolean;
  onFavorite: (id: string) => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
}

/** "석현동·조례동·덕월동 일대" from the 동 of the loaded cards. */
export function areaCaption(emdNames: readonly (string | null | undefined)[], max = 3): string {
  const names = [...new Set(emdNames.map(shortEmd).filter(Boolean))];
  if (names.length === 0) return '지도에 보이는 영역';
  const head = names.slice(0, max).join('·');
  return names.length > max ? `${head} 외 ${names.length - max}개 동` : `${head} 일대`;
}

/** Left panel body for 원룸·투룸 / 주택 / 상업·업무 / 토지 (OneRoom design). */
export function ListingPanel({
  asset,
  query,
  sort,
  onSortChange,
  view,
  onViewChange,
  unit,
  verifiedOnly,
  onVerifiedOnlyChange,
  selectedId,
  isFavorite,
  onFavorite,
  hasActiveFilters,
  onResetFilters,
}: ListingPanelProps) {
  const items = useMemo(() => flattenPages(query.data), [query.data]);
  const total = query.data?.pages[0]?.total;
  return (
    <>
      <div className={s.lpHd}>
        <div>
          <h2 className={s.lpTitle}>
            {asset.noun}{' '}
            <b className="num" aria-live="polite">
              {total === undefined ? '–' : total.toLocaleString('ko-KR')}
            </b>
            개
          </h2>
          <p className={s.lpSub}>지도 영역 · {areaCaption(items.map((l) => l.emdName))}</p>
        </div>
        <Switch
          className={s.lpSwitch}
          checked={verifiedOnly}
          onChange={(e) => onVerifiedOnlyChange(e.target.checked)}
        >
          실매물 확인만
        </Switch>
      </div>
      <div className={s.lpBar}>
        <SortTabs sorts={asset.sorts} value={sort} onChange={onSortChange} />
        {onViewChange && (
          <SegmentedControl
            className={s.viewSeg}
            label="보기 방식"
            size="sm"
            value={view}
            onChange={onViewChange}
            options={[
              {
                value: 'card',
                label: (
                  <>
                    <Icon name="grid" size={18} />
                    <span className="sr-only">카드로 보기</span>
                  </>
                ),
              },
              {
                value: 'list',
                label: (
                  <>
                    <Icon name="list" size={18} />
                    <span className="sr-only">목록으로 보기</span>
                  </>
                ),
              },
            ]}
          />
        )}
      </div>
      <div className={s.lpScroll}>
        <ListingList
          query={query}
          layout={view === 'card' ? 'card' : 'row'}
          unit={unit}
          selectedId={selectedId}
          isFavorite={isFavorite}
          onFavorite={onFavorite}
          showName
          hasActiveFilters={hasActiveFilters}
          onResetFilters={onResetFilters}
          emptyTitle={`이 지역에 조건에 맞는 ${asset.noun} 매물이 없어요`}
        />
      </div>
    </>
  );
}
