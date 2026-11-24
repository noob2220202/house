'use client';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  Panel,
  SegmentedControl,
  Skeleton,
  StatTile,
  StatusPill,
  Table,
  cx,
} from '@house/ui';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { AdminPageHeader } from '@/components/shell';
import { ADMIN_ROUTES } from '@/config/nav';
import { ApiError } from '@/lib/api';
import { formatCount, formatPercent } from '@/lib/format';
import { useBanner, useBannerSlots, useBannerStats } from '../api/hooks';
import { mediaUrl } from '../api/schemas';
import { useUrlState } from '../hooks/useUrlState';
import { formatDayFull, isDay, kstToday, toKstDay } from '../lib/dates';
import { slotLabel } from '../lib/slots';
import {
  dailyRows,
  METRIC_NAME,
  METRIC_OPTIONS,
  RANGE_PRESETS,
  resolveRange,
  summarize,
  type DailyRow,
  type Metric,
} from '../lib/stats';
import { displayCode, STATUS_PILL_LABEL, STATUS_TONE } from '../lib/status';
import { advertiserLine, targetSummary } from '../lib/summary';
import { AdImage } from './AdImage';
import styles from './stats.module.css';

const StatsChart = dynamic(() => import('./StatsChart'), {
  ssr: false,
  loading: () => <Skeleton height={260} radius={12} />,
});

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const weekdayOf = (day: string) => WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()] ?? '';

/** Per-banner statistics: range picker, KPI tiles, daily chart (노출 / 클릭 / CTR) and the daily table. */
export function StatsScreen({ bannerId }: { bannerId: string }) {
  const { params, set } = useUrlState();
  const range = resolveRange({
    range: params.get('range'),
    from: params.get('from'),
    to: params.get('to'),
  });
  const [metric, setMetric] = useState<Metric>('impressions');
  const banner = useBanner(bannerId);
  const slots = useBannerSlots();
  const stats = useBannerStats(bannerId, { from: range.from, to: range.to });

  const rows = useMemo(
    () => (stats.data ? dailyRows(stats.data, { from: range.from, to: range.to }) : []),
    [stats.data, range.from, range.to],
  );
  const summary = useMemo(() => summarize(rows), [rows]);
  const tableRows = useMemo(() => [...rows].reverse(), [rows]);
  const today = kstToday();
  const b = banner.data;
  const crumb = ['운영', { label: '배너·팝업 관리', href: ADMIN_ROUTES.banners }] as const;

  if (banner.isError) {
    const missing = banner.error instanceof ApiError && banner.error.isNotFound;
    return (
      <div className={styles.screen}>
        <AdminPageHeader title="배너 통계" crumb={crumb} />
        <Panel>
          <ErrorState
            title={missing ? '배너를 찾을 수 없어요' : '배너를 불러오지 못했어요'}
            description={missing ? '이미 삭제되었거나 주소가 잘못되었어요.' : undefined}
            onRetry={missing ? undefined : () => void banner.refetch()}
            action={
              <Button variant="secondary" href={ADMIN_ROUTES.banners} linkAs={Link}>
                배너 목록으로
              </Button>
            }
          />
        </Panel>
      </div>
    );
  }

  const image = mediaUrl(b?.pcMedia);
  const rangeText =
    rows.length > 0
      ? `${formatDayFull(rows[0]?.date ?? '')} – ${formatDayFull(rows[rows.length - 1]?.date ?? '')} · ${rows.length}일`
      : '';

  return (
    <div className={styles.screen}>
      <AdminPageHeader title="배너 통계" crumb={crumb} />
      <Link href={ADMIN_ROUTES.banners} className={styles.back}>
        <Icon name="chevron-left" size={18} />
        배너 목록
      </Link>

      {b ? (
        <section className={styles.head} aria-label="배너 정보">
          <span className={styles.thumb}>
            {image && (
              <AdImage
                src={image}
                alt=""
                sizes="(max-width: 720px) 100vw, 196px"
                position="left center"
              />
            )}
          </span>
          <div className={styles.info}>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>{b.title}</h2>
              <StatusPill tone={STATUS_TONE[b.status]}>{STATUS_PILL_LABEL[b.status]}</StatusPill>
            </div>
            <p className={styles.meta}>
              <span className={styles.tag}>
                {slotLabel(b.slot, slots.data)} {b.sortOrder}
              </span>
              <span className={styles.num}>{displayCode(b)}</span>
              <span>{advertiserLine(b)}</span>
            </p>
            <p className={styles.meta}>
              <span>
                <Icon name="calendar" size={14} />
                <span className={styles.num}>
                  {formatDayFull(toKstDay(b.startAt))} – {formatDayFull(toKstDay(b.endAt))}
                </span>
              </span>
              <span>
                <Icon name="map-pin" size={14} />
                {targetSummary(b)}
              </span>
            </p>
          </div>
          <div className={styles.headActions}>
            <Button
              variant="secondary"
              size="sm"
              href={`${ADMIN_ROUTES.banners}?edit=${b.id}`}
              linkAs={Link}
              iconLeft={<Icon name="edit" size={16} />}
            >
              배너 수정
            </Button>
          </div>
        </section>
      ) : (
        <Skeleton height={106} radius={16} />
      )}

      <div className={styles.rangeBar}>
        <SegmentedControl
          label="조회 기간"
          size="sm"
          options={RANGE_PRESETS}
          value={range.preset}
          onChange={(next) => {
            if (next === 'custom') {
              const from = range.from ?? (b ? toKstDay(b.startAt) : today);
              const to = range.to ?? today;
              set({ range: null, from: from <= to ? from : to, to });
            } else set({ range: next, from: null, to: null });
          }}
        />
        {range.preset === 'custom' ? (
          <div className={styles.custom} role="group" aria-label="조회 기간 직접 선택">
            <input
              type="date"
              className={styles.date}
              aria-label="조회 시작일"
              value={range.from ?? ''}
              max={range.to}
              onChange={(e) => {
                if (isDay(e.target.value) && (!range.to || e.target.value <= range.to))
                  set({ from: e.target.value });
              }}
            />
            <span aria-hidden="true">–</span>
            <input
              type="date"
              className={styles.date}
              aria-label="조회 종료일"
              value={range.to ?? ''}
              min={range.from}
              max={today}
              onChange={(e) => {
                if (isDay(e.target.value) && (!range.from || e.target.value >= range.from))
                  set({ to: e.target.value });
              }}
            />
          </div>
        ) : (
          <span className={styles.rangeText}>{rangeText}</span>
        )}
      </div>

      {stats.isError ? (
        <Panel>
          <ErrorState
            compact
            title="통계를 불러오지 못했어요"
            onRetry={() => void stats.refetch()}
          />
        </Panel>
      ) : stats.isPending ? (
        <div role="status" aria-label="통계 불러오는 중" className={styles.screen}>
          <div className={styles.kpis}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={104} radius={16} />
            ))}
          </div>
          <Skeleton height={340} radius={16} />
        </div>
      ) : (
        <div className={cx(styles.screen, stats.isPlaceholderData && styles.fetching)}>
          <div className={styles.kpis}>
            <StatTile
              label="노출수"
              value={formatCount(summary.impressions)}
              unit="회"
              detail={`일평균 ${formatCount(summary.avgImpressions)}회`}
              icon={<Icon name="eye" size={18} />}
            />
            <StatTile
              label="클릭수"
              value={formatCount(summary.clicks)}
              unit="회"
              detail={`일평균 ${formatCount(summary.avgClicks)}회`}
              icon={<Icon name="external-link" size={18} />}
            />
            <StatTile
              label="클릭률 (CTR)"
              value={summary.impressions > 0 ? formatPercent(summary.ctr) : '–'}
              detail="클릭 ÷ 노출"
              icon={<Icon name="chart" size={18} />}
              iconTone="brand"
            />
            <StatTile
              label="최다 노출일"
              value={summary.best ? formatDayFull(summary.best.date).slice(5) : '–'}
              unit={summary.best ? `(${weekdayOf(summary.best.date)})` : undefined}
              detail={
                summary.best ? `${formatCount(summary.best.impressions)}회 노출` : '데이터 없음'
              }
              icon={<Icon name="calendar" size={18} />}
            />
          </div>

          <Panel
            title={`일별 ${METRIC_NAME[metric]}`}
            description="KST 기준 · 같은 방문자의 하루 중복 노출은 한 번으로 셉니다"
            actions={
              <SegmentedControl
                label="지표"
                size="sm"
                options={METRIC_OPTIONS}
                value={metric}
                onChange={setMetric}
              />
            }
          >
            {summary.impressions === 0 ? (
              <EmptyState
                compact
                icon="chart"
                title="이 기간에는 노출 기록이 없어요"
                description={
                  // Compare instants: the API sends offsets ("…+09:00"), so strings do not sort.
                  b && Date.parse(b.startAt) > Date.now()
                    ? '아직 게시 전인 배너예요. 노출이 시작되면 다음 날부터 집계돼요.'
                    : '조회 기간을 넓혀 보세요.'
                }
              />
            ) : (
              <div className={styles.chartBox}>
                <StatsChart rows={rows} metric={metric} title={b?.title ?? '배너'} />
              </div>
            )}
          </Panel>

          {summary.impressions > 0 && (
            <Panel title="일별 상세" count={`${rows.length}일`} flush>
              <Table<DailyRow>
                caption="일별 노출수, 클릭수, 클릭률"
                bare
                density="compact"
                stickyHeader
                maxHeight={420}
                rows={tableRows}
                rowKey={(r) => r.date}
                columns={[
                  {
                    key: 'date',
                    header: '날짜',
                    cell: (r) => (
                      <span className={styles.num}>
                        {formatDayFull(r.date)} ({weekdayOf(r.date)})
                      </span>
                    ),
                  },
                  {
                    key: 'impressions',
                    header: '노출',
                    align: 'right',
                    cell: (r) => <span className={styles.num}>{formatCount(r.impressions)}</span>,
                  },
                  {
                    key: 'clicks',
                    header: '클릭',
                    align: 'right',
                    cell: (r) => <span className={styles.num}>{formatCount(r.clicks)}</span>,
                  },
                  {
                    key: 'ctr',
                    header: 'CTR',
                    align: 'right',
                    cell: (r) => (
                      <span className={styles.num}>
                        {r.impressions > 0 ? formatPercent(r.ctr) : '–'}
                      </span>
                    ),
                  },
                ]}
              />
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
