'use client';
import { Button, DealCount, EmptyState, ErrorState, Skeleton, Tabs, cx } from '@house/ui';
import type { UseQueryResult } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { loginUrl } from '@/lib/auth';
import type { ComplexSummary } from '../../api/schemas';
import type { AssetConfig } from '../../config/assets';
import { shortEmd } from '../../lib/listing';
import type { PanelTab } from '../../lib/state';
import type { RecentComplex } from '../../lib/storage';
import { CoverPhoto, PanelState, SortMenu } from '../shared';
import s from './panel.module.css';

/** A complex row needs only these fields, so popular / favourite / recent rows share it. */
export type ComplexRowData = Pick<
  ComplexSummary,
  | 'id'
  | 'name'
  | 'emdName'
  | 'households'
  | 'builtYear'
  | 'moveInYm'
  | 'counts'
  | 'pricePerPyeong'
  | 'lat'
  | 'lng'
> & { coverPhotoUrl?: string | null };

type ComplexSort = 'views' | 'count' | 'ppy' | 'built';
const SORTS: readonly { value: ComplexSort; label: string }[] = [
  { value: 'views', label: '조회순' },
  { value: 'count', label: '매물 많은순' },
  { value: 'ppy', label: '평당가 높은순' },
  { value: 'built', label: '최근 준공순' },
];
const total = (c: ComplexRowData) =>
  c.counts.presale + c.counts.sale + c.counts.jeonse + c.counts.monthly;

export function sortComplexes<T extends ComplexRowData>(
  rows: readonly T[],
  sort: ComplexSort,
): T[] {
  if (sort === 'views') return [...rows];
  const key: Record<Exclude<ComplexSort, 'views'>, (c: T) => number> = {
    count: total,
    ppy: (c) => c.pricePerPyeong ?? 0,
    built: (c) => c.builtYear ?? 0,
  };
  return [...rows].sort((a, b) => key[sort](b) - key[sort](a));
}

/** "1,412세대 · 2019년 준공" / "1,120세대 · 2027.03 입주 예정". */
export function complexMeta(
  c: Pick<ComplexSummary, 'households' | 'builtYear' | 'moveInYm'>,
  thisYear = new Date().getFullYear(),
): string {
  const built = c.moveInYm
    ? `${c.moveInYm} 입주 예정`
    : c.builtYear
      ? c.builtYear > thisYear
        ? `${c.builtYear}년 입주 예정`
        : `${c.builtYear}년 준공`
      : null;
  return [c.households ? `${c.households.toLocaleString('ko-KR')}세대` : null, built]
    .filter(Boolean)
    .join(' · ');
}

function ComplexListRow({
  complex: c,
  selected,
  onSelect,
}: {
  complex: ComplexRowData;
  selected: boolean;
  onSelect: (c: ComplexRowData) => void;
}) {
  const presale = c.counts.presale > 0 && c.counts.presale >= c.counts.sale;
  return (
    <li>
      <button
        type="button"
        className={cx(s.crow, selected && s.crowOn)}
        aria-pressed={selected}
        onClick={() => onSelect(c)}
      >
        <span className={s.crowThumb}>
          <CoverPhoto url={c.coverPhotoUrl} alt="" sizes="64px" placeholder="tower" />
        </span>
        <span className={s.crowMain}>
          <span className={s.crowTop}>
            <b className={s.crowName}>{c.name}</b>
            <span className={s.crowDong}>{shortEmd(c.emdName)}</span>
          </span>
          <span className={s.crowMeta}>{complexMeta(c)}</span>
          <span className={s.crowBot}>
            <DealCount counts={c.counts} />
            {c.pricePerPyeong ? (
              <span className={s.ppy}>
                <em>{presale ? '분양권 평당' : '평당 시세'}</em>
                <b className="num">{Math.round(c.pricePerPyeong).toLocaleString('ko-KR')}만</b>
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

function RowSkeletons() {
  return (
    <ul className={s.lpList} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className={s.crow}>
          <Skeleton width={64} height={64} radius={12} />
          <span className={s.crowMain}>
            <Skeleton width="60%" height={20} />
            <Skeleton width="45%" height={14} />
            <Skeleton width="100%" height={46} radius={8} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface ComplexPanelProps {
  asset: AssetConfig;
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  popular: UseQueryResult<ComplexSummary[]>;
  favorites: UseQueryResult<{ items: ComplexSummary[]; total: number }>;
  recents: readonly RecentComplex[];
  /** Session state: favourites need a signed-in user. */
  authed: boolean;
  sessionLoading: boolean;
  loginReturnTo: string;
  selectedId: string | null;
  onSelect: (c: ComplexRowData) => void;
}

/** 아파트 left panel body (MapApt design): tabs, summary line with sort, complex rows. */
export function ComplexPanel({
  asset,
  tab,
  onTabChange,
  popular,
  favorites,
  recents,
  authed,
  sessionLoading,
  loginReturnTo,
  selectedId,
  onSelect,
}: ComplexPanelProps) {
  const [sort, setSort] = useState<ComplexSort>('views');
  const source: readonly ComplexRowData[] | undefined =
    tab === 'popular' ? popular.data : tab === 'recent' ? recents : favorites.data?.items;
  const rows = useMemo(() => (source ? sortComplexes(source, sort) : []), [source, sort]);
  const query = tab === 'popular' ? popular : tab === 'favorite' && authed ? favorites : null;
  const loading =
    query?.isPending === true || (tab === 'favorite' && sessionLoading && !favorites.data);

  let content;
  if (tab === 'favorite' && !authed && !sessionLoading) {
    content = (
      <PanelState>
        <EmptyState
          compact
          icon="heart"
          title="로그인하고 관심 단지를 모아 보세요"
          description="단지 요약의 하트를 누르면 여기에 모입니다."
          action={
            <Button size="sm" href={loginUrl(loginReturnTo)} linkAs={Link}>
              로그인
            </Button>
          }
        />
      </PanelState>
    );
  } else if (loading) {
    content = <RowSkeletons />;
  } else if (query?.isError) {
    content = (
      <PanelState>
        <ErrorState compact onRetry={() => void query.refetch()} />
      </PanelState>
    );
  } else if (rows.length === 0) {
    content = (
      <PanelState>
        {tab === 'recent' ? (
          <EmptyState
            compact
            icon="clock"
            title="최근 본 단지가 없어요"
            description="지도에서 단지를 누르면 여기에 기록됩니다."
          />
        ) : tab === 'favorite' ? (
          <EmptyState
            compact
            icon="heart"
            title="관심 단지가 없어요"
            description="단지 요약의 하트를 눌러 담아 보세요."
          />
        ) : (
          <EmptyState compact icon="building" title="표시할 단지가 없어요" />
        )}
      </PanelState>
    );
  } else {
    content = (
      <ul className={s.lpList}>
        {rows.map((c) => (
          <ComplexListRow
            key={c.id}
            complex={c}
            selected={c.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    );
  }

  const caption =
    tab === 'popular' ? '최근 30일 조회순' : tab === 'recent' ? '최근에 본 순서' : '담은 순서';
  return (
    <>
      <Tabs
        className={s.lpTabs}
        label="단지 목록 보기"
        idBase="map-complex"
        value={tab}
        onChange={onTabChange}
        items={[
          { value: 'popular', label: '자주 찾는 단지' },
          { value: 'recent', label: '최근 본 단지', count: recents.length || undefined },
          {
            value: 'favorite',
            label: '관심 단지',
            count: authed ? favorites.data?.total || undefined : undefined,
          },
        ]}
      />
      <div
        className={s.lpBody}
        role="tabpanel"
        id={`map-complex-panel-${tab}`}
        aria-labelledby={`map-complex-tab-${tab}`}
      >
        <div className={s.lpSum}>
          <p className="t-cap">
            순천 {asset.noun} <b className="num">{rows.length}</b>개 단지 · {caption}
          </p>
          <SortMenu label="단지 정렬" value={sort} options={SORTS} onChange={setSort} />
        </div>
        {content}
      </div>
    </>
  );
}
