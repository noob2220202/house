'use client';
import { Button, EmptyState, ErrorState, SegmentedControl, Skeleton } from '@house/ui';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { formatCount, formatManwon, formatMonthly, formatPercent } from '@/lib/format';
import { complexKeys, fetchComplexStats, fetchComplexTrades } from '../api/queries';
import type { ComplexAreaType, ComplexStats, TradePage, TradeRecord } from '../api/schemas';
import { areaTypeLabel } from '../lib/listing';
import {
  BUCKET_LABEL,
  TREND_PERIODS,
  dealDateLabel,
  defaultAreaType,
  summarizeTrend,
  tradeAmount,
  trendSeries,
  type TrendPeriod,
} from '../lib/trend';
import styles from './page.module.css';

// The chart is a heavy, interaction-only widget → its own chunk, drawn after hydration.
const TradeChart = dynamic(() => import('./TradeChart'), {
  ssr: false,
  loading: () => <Skeleton width="100%" height={240} radius="var(--r-md)" />,
});

type ChartDeal = 'SALE' | 'JEONSE';
const DEAL_OPTIONS = [
  { value: 'SALE', label: '매매' },
  { value: 'JEONSE', label: '전세' },
] as const;
const TRADE_PAGE_SIZE = 8;

const tradePrice = (t: TradeRecord) => {
  if (t.dealType === 'MONTHLY' && t.monthlyRent !== null)
    return formatMonthly(t.deposit ?? 0, t.monthlyRent);
  const amount = tradeAmount(t);
  return amount === null ? '–' : formatManwon(amount);
};

export interface TradeSectionProps {
  complexId: string;
  complexName: string;
  areaTypes: readonly ComplexAreaType[];
  /** Server-fetched data of the default selection (매매 · most common 평형) for the first paint. */
  initialStats?: ComplexStats | null;
  initialTrades?: TradePage | null;
}

/** 실거래가: deal type / 평형 / period toggles, key figures, monthly-median chart and the trade list. */
export function TradeSection({
  complexId,
  complexName,
  areaTypes,
  initialStats,
  initialTrades,
}: TradeSectionProps) {
  const sorted = useMemo(
    () => [...areaTypes].sort((a, b) => a.exclusiveArea - b.exclusiveArea),
    [areaTypes],
  );
  const initialArea = defaultAreaType(areaTypes);
  const [deal, setDeal] = useState<ChartDeal>('SALE');
  const [areaId, setAreaId] = useState<string | undefined>(initialArea?.id);
  const [period, setPeriod] = useState<TrendPeriod>('3y');
  const area = sorted.find((a) => a.id === areaId) ?? initialArea ?? undefined;
  const isDefault = deal === 'SALE' && area?.id === initialArea?.id;

  const statsQuery = { dealType: deal, areaTypeId: area?.id };
  const stats = useQuery({
    queryKey: complexKeys.stats(complexId, statsQuery),
    queryFn: ({ signal }) => fetchComplexStats(complexId, statsQuery, signal),
    initialData: isDefault ? (initialStats ?? undefined) : undefined,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const tradesQuery = { ...statsQuery, pageSize: TRADE_PAGE_SIZE };
  const trades = useInfiniteQuery({
    queryKey: complexKeys.trades(complexId, tradesQuery),
    queryFn: ({ pageParam, signal }) =>
      fetchComplexTrades(complexId, { ...tradesQuery, page: pageParam }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    initialData:
      isDefault && initialTrades ? { pages: [initialTrades], pageParams: [1] } : undefined,
    staleTime: 5 * 60_000,
  });

  // While another series loads, the previous answer is kept only for `latest` (it covers every
  // 평형 × deal type); its monthly rows belong to the old selection and must not be shown.
  const seriesLoading = stats.isPending || stats.isPlaceholderData;
  const periodMonths = TREND_PERIODS.find((p) => p.value === period)?.months ?? null;
  const months = useMemo(
    () => (stats.isPlaceholderData ? [] : (stats.data?.months ?? [])),
    [stats.data, stats.isPlaceholderData],
  );
  // Calendar axis (gaps for months without trades), windows end at the current Seoul month.
  const view = useMemo(() => trendSeries(months, periodMonths), [months, periodMonths]);
  const year = useMemo(() => summarizeTrend(months, 12), [months]);
  const latest = stats.data?.latest.find(
    (t) => t.dealType === deal && t.areaTypeId === area?.id && !t.cancelled,
  );
  const latestAmount = latest ? tradeAmount(latest) : null;
  const yearBase = year.values[0];
  /** Ratio: 0.061 = +6.1%. */
  const yearChange = year.delta !== null && yearBase ? year.delta / yearBase : null;
  const rows = trades.data?.pages.flatMap((p) => p.items) ?? [];
  const total = trades.data?.pages[0]?.total ?? 0;
  const areaName = area ? areaTypeLabel(area) : '';
  const dealName = deal === 'SALE' ? '매매' : '전세';

  if (!area) {
    return (
      <section className={styles.sec} id="trades" aria-labelledby="trades-title">
        <h2 className={styles.secT} id="trades-title">
          실거래가
        </h2>
        <EmptyState compact icon="chart" title="평형 정보가 아직 등록되지 않았어요" />
      </section>
    );
  }

  return (
    <section className={styles.sec} id="trades" aria-labelledby="trades-title">
      <div className={styles.secHd}>
        <h2 className={styles.secT} id="trades-title">
          실거래가
        </h2>
        <div className={styles.controls}>
          <SegmentedControl
            label="거래 유형"
            size="sm"
            options={DEAL_OPTIONS}
            value={deal}
            onChange={setDeal}
          />
          <SegmentedControl
            label="평형"
            size="sm"
            options={sorted.map((a) => ({ value: a.id, label: areaTypeLabel(a) }))}
            value={area.id}
            onChange={setAreaId}
          />
        </div>
      </div>

      {stats.isError ? (
        <ErrorState
          compact
          title="실거래가를 불러오지 못했어요"
          description={errorMessage(stats.error)}
          onRetry={() => void stats.refetch()}
        />
      ) : (
        <>
          <dl className={styles.pstats} aria-busy={stats.isFetching || undefined}>
            <div>
              <dt>최근 실거래</dt>
              {stats.isPending ? (
                <Skeleton width={130} height={30} />
              ) : (
                <dd>{latestAmount === null ? '–' : formatManwon(latestAmount)}</dd>
              )}
              <span>
                {latest
                  ? `${dealDateLabel(latest.dealDate)} · ${areaName}${latest.floor !== null ? ` · ${latest.floor}층` : ''}`
                  : `${areaName} ${dealName} 거래 없음`}
              </span>
            </div>
            <div>
              <dt>1년 변동</dt>
              {seriesLoading ? (
                <Skeleton width={90} height={30} />
              ) : (
                <dd
                  className={
                    yearChange === null || yearChange === 0
                      ? undefined
                      : yearChange > 0
                        ? styles.up
                        : styles.down
                  }
                >
                  {yearChange === null
                    ? '–'
                    : `${yearChange > 0 ? '+' : ''}${formatPercent(yearChange)}`}
                </dd>
              )}
              <span>
                {seriesLoading
                  ? '불러오는 중'
                  : year.delta !== null && yearBase
                    ? `${year.startLabel} ${formatManwon(yearBase)} 대비`
                    : '비교할 거래가 부족해요'}
              </span>
            </div>
            <div>
              <dt>최근 1년 거래</dt>
              {seriesLoading ? (
                <Skeleton width={70} height={30} />
              ) : (
                <dd>
                  {formatCount(year.tradeCount)}
                  <small>건</small>
                </dd>
              )}
              <span>국토교통부 실거래가 공개 기준</span>
            </div>
          </dl>

          <div className={styles.chartWrap}>
            <div className={styles.chartLegend}>
              <span>
                <i aria-hidden="true" />
                {areaName} {dealName} {BUCKET_LABEL[view.bucket]} 중간값
              </span>
              <SegmentedControl
                label="기간"
                size="sm"
                options={TREND_PERIODS.map((p) => ({ value: p.value, label: p.label }))}
                value={period}
                onChange={setPeriod}
              />
              <span className={styles.chartUnit}>{view.rangeLabel}</span>
            </div>
            {seriesLoading ? (
              <Skeleton width="100%" height={240} radius="var(--r-md)" />
            ) : !view.hasData ? (
              <div className={styles.chartEmpty}>
                <EmptyState
                  compact
                  icon="chart"
                  title="이 기간에 신고된 거래가 없어요"
                  description="기간을 넓히거나 다른 평형을 선택해 보세요."
                />
              </div>
            ) : (
              <TradeChart
                label={`${complexName} ${areaName} ${dealName} 실거래가 ${BUCKET_LABEL[view.bucket]} 중간값`}
                seriesName={`${dealName} 중간값`}
                labels={view.labels}
                values={view.values}
              />
            )}
          </div>
        </>
      )}

      <div className={styles.tr}>
        <div className={styles.trHd}>
          <h3 className={styles.trT}>
            최근 실거래 · {areaName} {dealName}
          </h3>
          {total > 0 && <span className={styles.secSub}>전체 {formatCount(total)}건</span>}
        </div>
        {trades.isError ? (
          <ErrorState
            compact
            title="거래 내역을 불러오지 못했어요"
            description={errorMessage(trades.error)}
            onRetry={() => void trades.refetch()}
          />
        ) : trades.isPending ? (
          <Skeleton width="100%" height={220} radius="var(--r-md)" />
        ) : rows.length === 0 ? (
          <EmptyState compact icon="document" title="신고된 실거래가 없어요" />
        ) : (
          <>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.tradeTable}`}>
                <caption className="sr-only">
                  {complexName} {areaName} {dealName} 실거래 내역
                </caption>
                <thead>
                  <tr>
                    <th scope="col">계약일</th>
                    <th scope="col" className={styles.dealCol}>
                      거래
                    </th>
                    <th scope="col">층</th>
                    <th scope="col" className={styles.r}>
                      거래금액
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {dealDateLabel(t.dealDate)}
                        {/* Phones drop the 거래 column (the deal type is in the heading): tags move here. */}
                        <span className={styles.mTags}>
                          {t.contractType && <small>{t.contractType}</small>}
                          {t.cancelled && <small>해제</small>}
                        </span>
                      </td>
                      <td className={styles.dealCol}>
                        {dealName}
                        {t.contractType && <small>{t.contractType}</small>}
                        {t.cancelled && <small>해제</small>}
                      </td>
                      <td>{t.floor === null ? '–' : `${t.floor}층`}</td>
                      <td className={styles.r}>
                        <b className={t.cancelled ? styles.cancelled : undefined}>
                          {tradePrice(t)}
                        </b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {trades.hasNextPage && (
              <div className={styles.tableMore}>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={trades.isFetchingNextPage}
                  onClick={() => void trades.fetchNextPage()}
                >
                  거래 내역 더 보기 ({formatCount(rows.length)} / {formatCount(total)})
                </Button>
              </div>
            )}
          </>
        )}
        <p className={styles.note}>
          국토교통부 실거래가 공개시스템 신고 자료를 기준으로 하며, 계약 해제·정정 신고에 따라
          내용이 바뀔 수 있어요.
        </p>
      </div>
    </section>
  );
}
