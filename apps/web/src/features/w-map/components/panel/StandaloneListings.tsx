'use client';
import { useId } from 'react';
import type { AreaUnit } from '@/lib/format';
import { hasNoComplex } from '../../lib/selection';
import { ListingList, type ListingListQuery } from './ListingList';
import s from './panel.module.css';

export interface StandaloneListingsProps {
  /** Listings without a 단지 in the visible map that match the filters (the API total). */
  count: number;
  /** `GET /listings?withoutComplex=true&bbox=` of the visible map; any row of a 단지 is dropped. */
  query: ListingListQuery;
  unit: AreaUnit;
  selectedId?: string | null;
  /** Mobile: the picked pill's listings head the sheet, so this list leaves them out. */
  excludeIds?: ReadonlySet<string>;
  isFavorite: (id: string) => boolean;
  onFavorite: (id: string) => void;
}

/**
 * 아파트·분양권 panel section "단지 정보 없는 매물 N건": listings registered without a 단지 (the
 * broker typed the address in, or the complex is not in the database yet). The map shows them as
 * price pills instead of complex markers; this lists them with the regular listing rows.
 */
export function StandaloneListings({
  count,
  query,
  unit,
  selectedId,
  excludeIds,
  isFavorite,
  onFavorite,
}: StandaloneListingsProps) {
  const titleId = useId();
  return (
    <section className={s.solo} aria-labelledby={titleId}>
      <div className={s.soloHd}>
        <h3 id={titleId} className={s.soloTitle}>
          단지 정보 없는 매물 <b className="num">{count.toLocaleString('ko-KR')}</b>건
        </h3>
        <p className="t-cap">지도에 보이는 영역 · 단지에 연결되지 않은 매물</p>
      </div>
      <ListingList
        query={query}
        layout="row"
        unit={unit}
        selectedId={selectedId}
        excludeIds={excludeIds}
        include={hasNoComplex}
        isFavorite={isFavorite}
        onFavorite={onFavorite}
        showName
        emptyTitle="이 영역에 단지 정보 없는 매물이 없어요"
      />
    </section>
  );
}
