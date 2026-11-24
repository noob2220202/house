'use client';
import { AUTH_PROVIDER_LABEL } from '@house/shared';
import { EmptyState, SegmentedControl, Skeleton, cx } from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { formatCount, formatMonthDay, kstParts } from '@/lib/format';
import { coreKeys, fetchTraffic, type Traffic, type TrafficRange } from '../../api';
import {
  chartScale,
  deltaOf,
  formatDeltaPercent,
  isWeekend,
  peakIndex,
  plotPoint,
  showXLabel,
  trafficSummary,
  trafficTotals,
} from '../../lib/dashboard';
import { DashPanel, PanelError, PanelState } from './DashPanel';
import { Trend } from './KpiRow';
import styles from './dashboard.module.css';

const RANGES = [
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
] as const;

function usePlotWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = () => setWidth(el.clientWidth);
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Rough rendered width of a 12px/700 point label (Hangul ≈ 12px, Latin/digits ≈ 7px). */
function labelWidth(text: string): number {
  let w = 18 + 6;
  for (const ch of text) w += /[ㄱ-힝]/.test(ch) ? 12 : ch === ' ' ? 3.5 : 7;
  return w;
}

interface PointLabel {
  key: string;
  index: number;
  prefix: string;
  value: string;
  extra?: string;
  light?: boolean;
}

function TrafficChart({ traffic }: { traffic: Traffic }) {
  const [ref, width] = usePlotWidth();
  const [active, setActive] = useState<number | null>(null);
  const { points, previous } = traffic;
  const n = points.length;
  const values = points.map((p) => p.visitors);
  const prevValues = previous.slice(-n).map((p) => p.visitors);
  const { max, ticks } = chartScale([...values, ...prevValues]);
  const pos = (v: number, i: number) => plotPoint(v, i, n, max);
  const path = (vals: readonly number[]) =>
    vals
      .map((v, i) => {
        const p = pos(v, i);
        return `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
      })
      .join(' ');
  const line = path(values);
  const first = pos(values[0] ?? 0, 0);
  const last = pos(values[n - 1] ?? 0, n - 1);
  const peak = peakIndex(values);
  const dense = n > 10;

  // Labels: the hovered / focused point, otherwise "오늘" (+ the peak when it does not collide).
  const labels: PointLabel[] = [];
  if (active !== null && points[active]) {
    const prev = prevValues[active];
    labels.push({
      key: 'active',
      index: active,
      prefix: active === n - 1 ? '오늘' : formatMonthDay(points[active].date, true),
      value: formatCount(values[active]!),
      extra: prev === undefined ? undefined : `직전 ${formatCount(prev)}`,
    });
  } else if (n > 0) {
    const todayLabel: PointLabel = {
      key: 'today',
      index: n - 1,
      prefix: peak === n - 1 ? '오늘 최고' : '오늘',
      value: formatCount(values[n - 1]!),
    };
    if (peak >= 0 && peak !== n - 1) {
      const peakLabel: PointLabel = {
        key: 'peak',
        index: peak,
        prefix: `${kstParts(points[peak]!.date)?.weekday ?? ''} 최고`,
        value: formatCount(values[peak]!),
        light: true,
      };
      const a = pos(values[peak]!, peak);
      const gapX = ((last.x - a.x) / 100) * width;
      const need =
        (labelWidth(`${peakLabel.prefix} ${peakLabel.value}`) +
          labelWidth(`${todayLabel.prefix} ${todayLabel.value}`)) /
        2;
      // Before the first measurement (width 0) only the today label is drawn.
      if (width > 0 && gapX >= need - 6) labels.push(peakLabel);
    }
    labels.push(todayLabel);
  }

  /** Keeps a label inside the plot box by moving its anchor (and the little arrow with it). */
  const anchorOf = (label: PointLabel, x: number): string => {
    if (width <= 0) return '50%';
    const w = labelWidth(`${label.prefix} ${label.value}${label.extra ? ` ${label.extra}` : ''}`);
    const px = (x / 100) * width;
    const overRight = px + w / 2 - (width + 16);
    const overLeft = w / 2 - (px + 40);
    if (overRight > 0) return `${Math.min(92, 50 + (overRight / w) * 100).toFixed(1)}%`;
    if (overLeft > 0) return `${Math.max(8, 50 - (overLeft / w) * 100).toFixed(1)}%`;
    return '50%';
  };

  const onMove = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const i = Math.floor(((clientX - rect.left) / rect.width) * n);
    setActive(Math.max(0, Math.min(n - 1, i)));
  };

  return (
    <div className={styles.plot}>
      <div
        ref={ref}
        className={styles.plotArea}
        role="group"
        tabIndex={0}
        aria-label={`${trafficSummary(traffic)} 좌우 화살표 키로 날짜별 값을 탐색할 수 있어요.`}
        onMouseMove={(e) => onMove(e.clientX)}
        onMouseLeave={() => setActive(null)}
        onBlur={() => setActive(null)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setActive((a) => Math.max(0, (a ?? n) - 1));
          } else if (e.key === 'Escape') setActive(null);
        }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {[0.25, 33.33, 66.67].map((y) => (
            <path
              key={y}
              d={`M0 ${y}H100`}
              className={styles.gridLine}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d="M0 99.75H100" className={styles.baseLine} vectorEffect="non-scaling-stroke" />
          {prevValues.length === n && n > 1 && (
            <path
              d={path(prevValues)}
              className={styles.prevLine}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {n > 1 && (
            <>
              <path
                d={`${line} L${last.x.toFixed(2)} 100 L${first.x.toFixed(2)} 100 Z`}
                className={styles.area}
              />
              <path d={line} className={styles.line} vectorEffect="non-scaling-stroke" />
            </>
          )}
        </svg>
        {ticks.map((t, i) => (
          <span
            key={t}
            className={styles.ylab}
            style={{ top: `${(i / (ticks.length - 1)) * 100}%` }}
            aria-hidden="true"
          >
            {formatCount(t)}
          </span>
        ))}
        {active !== null && (
          <span
            className={styles.cursor}
            style={{ left: `${pos(0, active).x}%` }}
            aria-hidden="true"
          />
        )}
        {values.map((v, i) => {
          const p = pos(v, i);
          const isToday = i === n - 1;
          const isActive = i === active;
          if (dense && !isToday && !isActive && i !== peak) return null;
          return (
            <span
              key={i}
              aria-hidden="true"
              className={cx(
                styles.pt,
                dense && !isToday && !isActive && styles.sm,
                isToday && active === null && styles.today,
                isActive && styles.active,
              )}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
            />
          );
        })}
        {labels.map((label) => {
          const p = pos(values[label.index]!, label.index);
          return (
            <span
              key={label.key}
              aria-hidden="true"
              className={cx(styles.plab, label.light && styles.light)}
              style={
                { left: `${p.x}%`, top: `${p.y}%`, '--ax': anchorOf(label, p.x) } as CSSProperties
              }
            >
              {label.prefix} <b>{label.value}</b>
              {label.extra && <em>{label.extra}</em>}
            </span>
          );
        })}
        <span className="sr-only" aria-live="polite">
          {active !== null && points[active]
            ? `${formatMonthDay(points[active].date, true)}요일 방문자 ${formatCount(values[active]!)}명${
                prevValues[active] === undefined
                  ? ''
                  : `, 직전 기간 ${formatCount(prevValues[active])}명`
              }`
            : ''}
        </span>
      </div>
      <div className={styles.xlabs} aria-hidden="true">
        {points.map((p, i) => {
          if (!showXLabel(i, n)) return <span key={p.date} />;
          if (i === n - 1)
            return (
              <span key={p.date} className={styles.now}>
                오늘
              </span>
            );
          const parts = kstParts(p.date);
          return (
            <span key={p.date} className={cx(isWeekend(p.date) && styles.we)}>
              {formatMonthDay(p.date)}
              {!dense && <span className={styles.dw}>{parts?.weekday}</span>}
            </span>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>일별 순 방문자</caption>
        <thead>
          <tr>
            <th scope="col">날짜</th>
            <th scope="col">방문자</th>
            <th scope="col">직전 기간</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={p.date}>
              <th scope="row">{formatMonthDay(p.date, true)}</th>
              <td>{formatCount(p.visitors)}</td>
              <td>{prevValues[i] === undefined ? '-' : formatCount(prevValues[i])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TrafficStats({ traffic }: { traffic: Traffic }) {
  const totals = trafficTotals(traffic);
  const visitors = deltaOf(totals.visitors, totals.visitorsPrev);
  const pageViews = deltaOf(totals.pageViews, totals.pageViewsPrev);
  const { signups } = traffic;
  const share = [...signups.byProvider]
    .filter((p) => p.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 2)
    .map(
      (p) =>
        `${AUTH_PROVIDER_LABEL[p.provider]} ${Math.round((p.count / Math.max(1, signups.total)) * 100)}%`,
    )
    .join(' · ');
  return (
    <dl className={styles.stats}>
      <div className={styles.cstat}>
        <dt>{traffic.points.length}일 방문자</dt>
        <dd className={styles.cstatV}>
          {formatCount(totals.visitors)}
          {visitors.ratio !== null && (
            <Trend
              delta={visitors}
              text={formatDeltaPercent(visitors)}
              className={styles.cstatDelta}
            />
          )}
        </dd>
      </div>
      <div className={styles.cstat}>
        <dt>페이지뷰</dt>
        <dd className={styles.cstatV}>
          {formatCount(totals.pageViews)}
          {pageViews.ratio !== null && (
            <Trend
              delta={pageViews}
              text={formatDeltaPercent(pageViews)}
              className={styles.cstatDelta}
            />
          )}
        </dd>
      </div>
      <div className={styles.cstat}>
        <dt>신규 가입</dt>
        <dd className={styles.cstatV}>
          {formatCount(signups.total)}
          <small>명</small>
        </dd>
        {share && <dd className={styles.cstatS}>{share}</dd>}
      </div>
    </dl>
  );
}

function TrafficSkeleton() {
  return (
    <div className={styles.chartBody} aria-hidden="true">
      <div className={styles.stats} style={{ gap: 14 }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
            <Skeleton width={64} height={12} />
            <Skeleton width={104} height={22} />
          </div>
        ))}
      </div>
      <div className={styles.plot}>
        <Skeleton height={128} radius={8} />
        <div style={{ height: 34 }} />
      </div>
    </div>
  );
}

/** 방문 추이: 7 / 30 day unique visitors against the preceding period. */
export function TrafficPanel() {
  const [range, setRange] = useState<TrafficRange>(7);
  const query = useQuery({
    queryKey: coreKeys.traffic(range),
    queryFn: ({ signal }) => fetchTraffic(range, signal),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const { data } = query;
  const shown = data?.points.length || range;
  return (
    <DashPanel
      title="방문 추이"
      caption="순 방문자 · 하루 단위"
      actions={
        <>
          <div className={styles.legend} aria-hidden="true">
            <span>
              <i />
              최근 {shown}일
            </span>
            <span>
              <i className={styles.prev} />
              직전 {shown}일
            </span>
          </div>
          <SegmentedControl
            label="조회 기간"
            size="sm"
            options={RANGES}
            value={range === 30 ? '30' : '7'}
            onChange={(v) => setRange(v === '30' ? 30 : 7)}
          />
        </>
      }
    >
      {query.isPending ? (
        <TrafficSkeleton />
      ) : query.isError || !data ? (
        <div className={styles.chartBody}>
          <div style={{ gridColumn: '1 / -1', display: 'grid' }}>
            <PanelError what="방문 추이를" onRetry={() => void query.refetch()} />
          </div>
        </div>
      ) : data.points.length === 0 ? (
        <div className={styles.chartBody}>
          <div style={{ gridColumn: '1 / -1', display: 'grid' }}>
            <PanelState>
              <EmptyState
                compact
                icon="chart"
                title="아직 방문 데이터가 없어요"
                description="방문 기록이 쌓이면 이곳에 추이가 표시됩니다."
              />
            </PanelState>
          </div>
        </div>
      ) : (
        <div
          className={styles.chartBody}
          style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}
          aria-busy={query.isPlaceholderData || undefined}
        >
          <TrafficStats traffic={data} />
          <TrafficChart traffic={data} />
        </div>
      )}
    </DashPanel>
  );
}
