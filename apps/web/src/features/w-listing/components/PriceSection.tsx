'use client';
import { DealType, TradeDealType } from '@house/shared';
import { EmptyState, ErrorState, SegmentedControl, Skeleton, cx } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ROUTES } from '@/config/nav';
import { ApiError } from '@/lib/api';
import { formatDateShort, formatManwon } from '@/lib/format';
import { fetchComplexStats, fetchComplexTrades, listingKeys } from '../api/client';
import type { ListingComplex } from '../api/schemas';
import { buildPriceChart, formatYm, summarizeStats, tradeAmount } from '../lib/chart';
import { PriceChart } from './PriceChart';
import styles from './price.module.css';
import page from './page.module.css';

export interface PriceSectionProps {
  complex: ListingComplex;
  /** The listing's own 평형 / deal / asking price — drawn as the dashed "이 매물" line. */
  areaTypeId: string | null;
  dealType: DealType;
  askingPrice: number | null;
}

const DEAL_OPTIONS = [
  { value: TradeDealType.SALE, label: '매매' },
  { value: TradeDealType.JEONSE, label: '전세' },
] as const;
type ChartDeal = (typeof DEAL_OPTIONS)[number]['value'];

const listingTradeDeal = (deal: DealType): ChartDeal =>
  deal === DealType.JEONSE || deal === DealType.MONTHLY ? TradeDealType.JEONSE : TradeDealType.SALE;

/** 36 months back from now, as YYYYMM. */
function fromYm(): number {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear() - 3, now.getUTCMonth(), 1));
  return d.getUTCFullYear() * 100 + d.getUTCMonth() + 1;
}

/** 단지 시세 · 실거래가 — monthly median line, 실거래 dots and this listing's asking price. */
export function PriceSection({ complex, areaTypeId, dealType, askingPrice }: PriceSectionProps) {
  const areaTypes = complex.areaTypes;
  const [deal, setDeal] = useState<ChartDeal>(listingTradeDeal(dealType));
  const [area, setArea] = useState<string | null>(
    areaTypes.find((t) => t.id === areaTypeId)?.id ?? areaTypes[0]?.id ?? null,
  );
  const params = { dealType: deal, areaTypeId: area };
  const since = useMemo(fromYm, []);

  const stats = useQuery({
    queryKey: listingKeys.stats(complex.id, params),
    queryFn: ({ signal }) => fetchComplexStats(complex.id, params, signal),
    staleTime: 5 * 60_000,
  });
  const trades = useQuery({
    queryKey: listingKeys.trades(complex.id, params),
    queryFn: ({ signal }) => fetchComplexTrades(complex.id, { ...params, fromYm: since }, signal),
    staleTime: 5 * 60_000,
  });

  const areaLabel = areaTypes.find((t) => t.id === area)?.pyeongLabel ?? '';
  const dealLabel = deal === TradeDealType.SALE ? '매매' : '전세';
  const isOwnSeries =
    area === areaTypeId &&
    deal === listingTradeDeal(dealType) &&
    dealType !== DealType.MONTHLY &&
    dealType !== DealType.PRESALE;
  const ask = isOwnSeries ? askingPrice : null;

  const months = useMemo(
    () => (stats.data?.months ?? []).filter((m) => m.yearMonth >= since),
    [stats.data, since],
  );
  const rows = useMemo(
    () =>
      (trades.data?.items ?? [])
        .filter((t) => !t.cancelled)
        .sort((a, b) => b.dealDate.localeCompare(a.dealDate)),
    [trades.data],
  );
  const model = useMemo(() => buildPriceChart(months, rows, ask), [months, rows, ask]);
  const summary = useMemo(() => summarizeStats(months), [months]);

  const pending = stats.isPending || trades.isPending;
  const failed = stats.isError || trades.isError;
  const error = stats.error ?? trades.error;
  const latest = rows[0];
  const first = months[0];
  const last = months[months.length - 1];

  const caption =
    model && summary && first && last
      ? `${complex.name} ${areaLabel} ${dealLabel} 시세와 실거래가, ${formatYm(first.yearMonth)}부터 ${formatYm(last.yearMonth)}까지. ` +
        `시세 중간값은 ${formatManwon(first.medianPrice)}에서 ${formatManwon(last.medianPrice)}로 바뀌었고` +
        (latest
          ? `, 최근 실거래는 ${formatDateShort(latest.dealDate)} ${formatManwon(tradeAmount(latest) ?? 0)}`
          : '') +
        (ask ? `, 이 매물 호가는 ${formatManwon(ask)}입니다.` : '입니다.')
      : '';

  return (
    <section className={page.sec} aria-labelledby="s-price">
      <div className={page.secHd}>
        <h2 className={page.secT} id="s-price">
          단지 시세 · 실거래가
        </h2>
        <div className={styles.controls}>
          <SegmentedControl
            label="거래 유형"
            options={DEAL_OPTIONS}
            value={deal}
            onChange={setDeal}
            size="sm"
          />
          {areaTypes.length > 1 && (
            <SegmentedControl
              label="평형"
              options={areaTypes.map((t) => ({
                value: t.id,
                label: t.pyeongLabel ?? `${t.exclusiveArea}㎡`,
              }))}
              value={area ?? undefined}
              onChange={setArea}
              size="sm"
            />
          )}
        </div>
      </div>

      {pending ? (
        <div aria-busy="true" aria-label="시세 불러오는 중" className={styles.loading}>
          <div className={styles.pstats}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={92} radius="var(--r-lg)" />
            ))}
          </div>
          <Skeleton height={320} radius="var(--r-lg)" />
        </div>
      ) : failed ? (
        <ErrorState
          compact
          title="시세를 불러오지 못했어요"
          description="잠시 후 다시 시도해 주세요."
          onRetry={() => {
            void stats.refetch();
            void trades.refetch();
          }}
          code={error instanceof ApiError ? error.requestId : undefined}
        />
      ) : !model || !summary ? (
        <EmptyState
          compact
          icon="chart"
          title={`${areaLabel} ${dealLabel} 실거래가 아직 없어요`}
          description="국토교통부 실거래가 공개 자료에 신고된 거래가 생기면 여기에 표시돼요."
        />
      ) : (
        <>
          <dl className={styles.pstats}>
            <div>
              <dt>시세 중간값</dt>
              <dd className="num">{formatManwon(summary.latestMedian)}</dd>
              <span>
                {formatYm(summary.latestYm)} · {areaLabel} 실거래 기준
              </span>
            </div>
            <div>
              <dt>1년 변동</dt>
              {summary.changeRatio !== null ? (
                <dd
                  className={cx(
                    'num',
                    summary.changeRatio > 0 && styles.up,
                    summary.changeRatio < 0 && styles.down,
                  )}
                >
                  {summary.changeRatio > 0 ? '+' : summary.changeRatio < 0 ? '−' : ''}
                  {Math.abs(summary.changeRatio * 100).toFixed(1)}%
                </dd>
              ) : (
                <dd className="num">-</dd>
              )}
              <span>
                {summary.yearAgoMedian !== null && summary.yearAgoYm !== null
                  ? `${formatYm(summary.yearAgoYm)} ${formatManwon(summary.yearAgoMedian)} 대비`
                  : '비교할 1년 전 거래가 없어요'}
              </span>
            </div>
            <div>
              <dt>최근 1년 거래</dt>
              <dd className="num">
                {summary.tradeCount12m}
                <small>건</small>
              </dd>
              <span>국토부 실거래가 공개 기준</span>
            </div>
          </dl>

          <div className={styles.chartWrap}>
            <div className={styles.legend} aria-hidden="true">
              <span>
                <i className={styles.lgLine} />
                시세 중간값
              </span>
              <span>
                <i className={styles.lgDot} />
                실거래가
              </span>
              {ask !== null && (
                <span>
                  <i className={styles.lgAsk} />이 매물 호가
                </span>
              )}
              {first && last && (
                <span className={styles.unit}>
                  단위 억원 · {formatYm(first.yearMonth)} – {formatYm(last.yearMonth)}
                </span>
              )}
            </div>
            <PriceChart model={model} ask={ask} caption={caption} dealLabel={dealLabel} />
          </div>

          {rows.length > 0 && (
            <div className={styles.tr}>
              <div className={styles.trHd}>
                <h3 className={styles.trT}>최근 실거래{areaLabel ? ` · ${areaLabel}` : ''}</h3>
                <Link
                  className={cx('link', 't-sm', styles.trAll)}
                  href={`${ROUTES.complex(complex.id)}#trades`}
                >
                  전체 {trades.data?.total ?? rows.length}건
                </Link>
              </div>
              <table className={styles.table}>
                <caption className="sr-only">
                  {complex.name} {areaLabel} 최근 {dealLabel} 실거래
                </caption>
                <thead>
                  <tr>
                    <th scope="col">계약일</th>
                    <th scope="col">층</th>
                    <th scope="col" className={styles.r}>
                      {deal === TradeDealType.SALE ? '거래금액' : '보증금'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 4).map((t) => (
                    <tr key={t.id}>
                      <td className="num">{formatDateShort(t.dealDate)}</td>
                      <td>{t.floor !== null && t.floor !== undefined ? `${t.floor}층` : '-'}</td>
                      <td className={cx(styles.r, styles.strong, 'num')}>
                        {formatManwon(tradeAmount(t) ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
