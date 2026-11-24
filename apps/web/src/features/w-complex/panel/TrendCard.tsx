'use client';
import { Delta, Skeleton, Sparkline } from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { formatManwon, type AreaUnit } from '@/lib/format';
import { complexKeys, fetchComplexStats } from '../api/queries';
import type { ComplexAreaType } from '../api/schemas';
import { areaTypeLabel } from '../lib/listing';
import {
  dealMonthLabel,
  defaultAreaType,
  latestByAreaType,
  summarizeTrend,
  tradeAmount,
} from '../lib/trend';
import styles from './panel.module.css';

/** Width of an element, tracked with a ResizeObserver (the sparkline is drawn in real pixels). */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => {
      if (el.clientWidth > 0) setWidth(el.clientWidth);
    };
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

export interface TrendCardProps {
  complexId: string;
  areaTypes: readonly ComplexAreaType[];
  unit: AreaUnit;
}

/** 실거래가 card: latest 매매 price + 1-year sparkline of the selected 평형, and the latest trade per 평형. */
export function TrendCard({ complexId, areaTypes, unit }: TrendCardProps) {
  const [picked, setPicked] = useState<string | null>(null);
  const selected =
    areaTypes.find((a) => a.id === picked) ?? defaultAreaType(areaTypes) ?? undefined;
  const [sparkRef, sparkWidth] = useWidth(200);

  const query = { dealType: 'SALE' as const, areaTypeId: selected?.id };
  const { data, isPending, isError, isPlaceholderData } = useQuery({
    queryKey: complexKeys.stats(complexId, query),
    queryFn: ({ signal }) => fetchComplexStats(complexId, query, signal),
    enabled: !!selected,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });

  if (!selected) return null;
  const rows = latestByAreaType(areaTypes, data?.latest ?? []);
  const current = rows.find((r) => r.areaType.id === selected.id)?.trade ?? null;
  const amount = current ? tradeAmount(current) : null;
  const trend = summarizeTrend(isPlaceholderData ? [] : (data?.months ?? []), 12);
  const name = areaTypeLabel(selected, unit);
  const up = (trend.delta ?? 0) > 0;

  return (
    <section className={styles.trend} aria-label="실거래가">
      <div className={styles.trendL}>
        <p className={styles.trendK}>{name} 실거래가 · 최근 1년</p>
        {isPending ? (
          <>
            <Skeleton width={120} height={25} />
            <Skeleton width="100%" height={46} style={{ marginTop: 4 }} />
          </>
        ) : isError || amount === null ? (
          <p className={styles.trendNone}>
            {isError ? '실거래가를 불러오지 못했어요' : '최근 실거래가 없어요'}
          </p>
        ) : (
          <>
            <p className={styles.trendV}>
              <b>{formatManwon(amount)}</b>
              {trend.delta !== null && trend.delta !== 0 && (
                <Delta direction={up ? 'up' : 'down'} className={styles.trendDelta}>
                  {formatManwon(Math.abs(trend.delta))}
                </Delta>
              )}
            </p>
            {/* The box is always rendered: it is measured for the sparkline and keeps the card height. */}
            <div ref={sparkRef} className={styles.sparkBox}>
              {trend.values.length >= 2 && (
                <Sparkline
                  values={trend.values}
                  width={sparkWidth}
                  height={28}
                  endDot={false}
                  label={`${name} 매매 실거래가 추이, ${trend.startLabel}부터 ${trend.endLabel}까지 ${
                    trend.delta === null || trend.delta === 0
                      ? '변동 없음'
                      : `${formatManwon(Math.abs(trend.delta))}만원 ${up ? '상승' : '하락'}`
                  }`}
                />
              )}
              {trend.values.length === 0 && (
                <p className={styles.trendStale}>
                  최근 1년 거래 없음
                  {current && <> · 마지막 거래 {dealMonthLabel(current.dealDate)}</>}
                </p>
              )}
            </div>
            <p className={styles.trendAx} aria-hidden="true">
              <span>{trend.startLabel}</span>
              <span>{trend.endLabel}</span>
            </p>
          </>
        )}
      </div>
      <div className={styles.trendR} role="group" aria-label="평형별 최근 실거래">
        {rows.map(({ areaType, trade }) => {
          const value = trade ? tradeAmount(trade) : null;
          return (
            <button
              key={areaType.id}
              type="button"
              className={styles.pyb}
              aria-pressed={areaType.id === selected.id}
              onClick={() => setPicked(areaType.id)}
            >
              <span className={styles.py}>{areaTypeLabel(areaType, unit)}</span>
              {isPending ? (
                <Skeleton width={70} height={16} />
              ) : value !== null ? (
                <span className={styles.pv}>{formatManwon(value)}</span>
              ) : (
                <span className={styles.pvNone}>거래 없음</span>
              )}
              <span className={styles.pd}>{trade ? dealMonthLabel(trade.dealDate) : ''}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
