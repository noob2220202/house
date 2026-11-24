'use client';
import type { AssetType } from '@house/shared';
import { Button, EmptyState, ErrorState, Icon, SegmentedControl, Tabs } from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { MapAssetSlug } from '@/config/nav';
import { formatDate, formatMonthDay } from '@/lib/format/date';
import { fetchPopularComplexes, fetchPopularRegions, homeKeys } from '../../api/client';
import type { PopularComplex } from '../../api/schemas';
import { HOME_CATEGORIES, HOME_LIMITS, categoryOf } from '../../config';
import { mapHref } from '../../lib/links';
import { complexRankRow, regionRankRow, type RankMode, type RankRow } from '../../lib/ranking';
import { SectionHeader } from '../SectionHeader';
import { RankFeature, RankFeatureMobile } from './RankFeature';
import { RankList } from './RankList';
import { RankSkeleton } from './RankSkeleton';
import { RankTable } from './RankTable';
import styles from './Ranking.module.css';

const ID = 'home-rank';
const TABS = HOME_CATEGORIES.map((c) => ({ value: c.slug, label: c.label }));
const STALE_MS = 5 * 60_000;
/** Only apartments are grouped into 단지; the other categories are ranked by 동. */
const COMPLEX_TAB: MapAssetSlug = 'apt';
const MOBILE_ROWS = 4;

export interface RankingSectionProps {
  /** Server-fetched 아파트 단지 ranking; undefined → fetched on the client (with error state). */
  initial: { items: PopularComplex[]; updatedAt: string | null } | undefined;
}

/**
 * "사람들이 자주 찾는 단지": category tabs + 단지/지역 toggle, a featured #1 card and the rest with
 * 분양·매매·전세·월세 counts. Desktop = card + table (Main), mobile = card + compact list (MobileHome).
 */
export function RankingSection({ initial }: RankingSectionProps) {
  const [tab, setTab] = useState<MapAssetSlug>(COMPLEX_TAB);
  const [wanted, setWanted] = useState<RankMode>('complex');
  const mode: RankMode = tab === COMPLEX_TAB ? wanted : 'region';
  const assetTypes: readonly AssetType[] = categoryOf(tab).assetTypes;
  const limit = HOME_LIMITS.ranking;

  const complexes = useQuery({
    queryKey: homeKeys.popularComplexes(assetTypes, limit),
    queryFn: ({ signal }) => fetchPopularComplexes(assetTypes, limit, signal),
    enabled: mode === 'complex',
    initialData: tab === COMPLEX_TAB ? initial : undefined,
    staleTime: STALE_MS,
  });
  const regions = useQuery({
    queryKey: homeKeys.popularRegions(assetTypes, limit),
    queryFn: ({ signal }) => fetchPopularRegions(assetTypes, limit, signal),
    enabled: mode === 'region',
    staleTime: STALE_MS,
    placeholderData: keepPreviousData,
  });

  const active = mode === 'complex' ? complexes : regions;
  const rows: RankRow[] = useMemo(() => {
    if (mode === 'complex')
      return (complexes.data?.items ?? []).map((c, i) => complexRankRow(c, i));
    return (regions.data?.items ?? []).map((r, i) => regionRankRow(r, i, tab));
  }, [mode, tab, complexes.data, regions.data]);

  const updatedAt = active.data?.updatedAt ?? null;
  const first = rows[0];
  const rest = rows.slice(1);
  const noun = mode === 'complex' ? '단지' : '지역';
  const stale = active.isPlaceholderData;

  return (
    <section className={styles.section} aria-labelledby={`${ID}-h`}>
      <div className="container">
        <SectionHeader
          id={`${ID}-h`}
          title={mode === 'complex' ? '사람들이 자주 찾는 단지' : '사람들이 자주 찾는 동네'}
          caption={
            <>
              최근 7일 조회 기준
              {updatedAt && (
                <>
                  <span className="only-lg"> · {formatDate(updatedAt)} 업데이트</span>
                  <span className="only-sm"> · {formatMonthDay(updatedAt)} 업데이트</span>
                </>
              )}
            </>
          }
          actions={
            <SegmentedControl<RankMode>
              label="순위 기준"
              value={mode}
              onChange={setWanted}
              options={[
                { value: 'complex', label: '단지', disabled: tab !== COMPLEX_TAB },
                { value: 'region', label: '지역' },
              ]}
            />
          }
          mobileMore={{
            href: mapHref(tab),
            label: '전체',
            ariaLabel: `${categoryOf(tab).label} 지도에서 전체 보기`,
          }}
        />
        <Tabs
          className={styles.tabs}
          label="매물 종류"
          items={TABS}
          value={tab}
          onChange={setTab}
          idBase={ID}
        />
        <div
          role="tabpanel"
          id={`${ID}-panel-${tab}`}
          aria-labelledby={`${ID}-tab-${tab}`}
          aria-busy={active.isFetching}
          className={stale ? styles.stale : undefined}
        >
          {active.isPending ? (
            <RankSkeleton />
          ) : active.isError ? (
            <ErrorState
              className={styles.state}
              title="순위를 불러오지 못했어요"
              onRetry={() => void active.refetch()}
            />
          ) : !first ? (
            <EmptyState
              className={styles.state}
              icon="chart"
              title={`아직 집계된 ${noun} 순위가 없어요`}
              description="지도에서 조건에 맞는 매물을 바로 찾아보세요."
              action={
                <Button
                  href={mapHref(tab)}
                  linkAs={Link}
                  variant="secondary"
                  iconRight={<Icon name="arrow-right" size={18} />}
                >
                  지도에서 찾기
                </Button>
              }
            />
          ) : (
            <>
              <div className={`only-lg ${styles.rank}`}>
                <RankFeature row={first} />
                <RankTable rows={rest} mode={mode} />
              </div>
              <div className={`only-sm ${styles.rankSm}`}>
                <RankFeatureMobile row={first} />
                <RankList rows={rest.slice(0, MOBILE_ROWS - 1)} />
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
