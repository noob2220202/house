'use client';
import {
  ASSET_TYPE_LABEL,
  AUTH_PROVIDER_LABEL,
  DEAL_TYPE_LABEL,
  type DealType,
} from '@house/shared';
import { EmptyState, Panel, Table, cx, type TableColumn } from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ADMIN_ROUTES } from '@/config/nav';
import { qk, type QueryParams } from '@/lib/api';
import { formatCount, formatPercent } from '@/lib/format';
import { stats } from '../api';
import type { AdStats, DealRequestStats, ListingStats, TrafficStats } from '../api/schemas';
import { formatMinutes, ratio, total } from '../lib/stats';
import { BarList, type BarItem } from './BarList';
import { DailyTable, Kpi, SectionState, TrendPanel, type Days, type Metric } from './parts';
import styles from './stats.module.css';

interface SectionProps {
  days: Days;
  dev: QueryParams;
}

const DEAL_TONE: Record<DealType, NonNullable<BarItem['tone']>> = {
  SALE: 'sale',
  JEONSE: 'jeonse',
  MONTHLY: 'monthly',
  PRESALE: 'presale',
};
const fixed = (digits: number) => (v: number) => v.toFixed(digits);
const signed = (v: number) => `${v > 0 ? '+' : ''}${formatCount(v)}`;

// ---------- 방문 · 가입 ----------

type TrafficPoint = TrafficStats['points'][number];
const TRAFFIC_METRICS: [Metric<TrafficPoint>, ...Metric<TrafficPoint>[]] = [
  { key: 'visitors', label: '방문자', unit: '명', value: (r) => total(r, (p) => p.visitors) },
  { key: 'pageViews', label: '페이지뷰', unit: '회', value: (r) => total(r, (p) => p.pageViews) },
  { key: 'signups', label: '신규 가입', unit: '명', value: (r) => total(r, (p) => p.signups) },
];

export function TrafficSection({ days, dev }: SectionProps) {
  const params = { days, ...dev };
  const query = useQuery({
    queryKey: qk('admin-stats', 'traffic', params),
    queryFn: ({ signal }) => stats.traffic(params, { signal }),
    placeholderData: keepPreviousData,
  });
  if (!query.data)
    return (
      <SectionState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  const d = query.data;
  const visitors = total(d.points, (p) => p.visitors);
  const pageViews = total(d.points, (p) => p.pageViews);
  const signups = total(d.points, (p) => p.signups);
  const depth = ratio(pageViews, visitors);
  const prevDepth = ratio(d.previous.pageViews, d.previous.visitors);
  const none = d.points.length === 0;

  return (
    <>
      <div className={styles.kpis}>
        <Kpi
          label="방문자"
          value={none ? '–' : formatCount(visitors)}
          unit={none ? undefined : '명'}
          current={none ? undefined : visitors}
          previous={d.previous.visitors}
          days={days}
          icon="users"
          brand
        />
        <Kpi
          label="페이지뷰"
          value={none ? '–' : formatCount(pageViews)}
          unit={none ? undefined : '회'}
          current={none ? undefined : pageViews}
          previous={d.previous.pageViews}
          days={days}
          icon="eye"
        />
        <Kpi
          label="신규 가입"
          value={none ? '–' : formatCount(signups)}
          unit={none ? undefined : '명'}
          current={none ? undefined : signups}
          previous={d.previous.signups}
          days={days}
          icon="user"
        />
        <Kpi
          label="방문당 페이지뷰"
          value={none ? '–' : depth.toFixed(1)}
          unit={none ? undefined : '쪽'}
          current={none ? undefined : depth}
          previous={prevDepth}
          days={days}
          icon="document"
        />
      </div>

      <div className={styles.row}>
        <TrendPanel title="방문 추이" points={d.points} metrics={TRAFFIC_METRICS} days={days} />
        <div className={styles.side}>
          <Panel title="접속 기기" description="페이지뷰 기준">
            <BarList
              label="접속 기기별 페이지뷰"
              unit="회"
              items={[
                { key: 'mobile', label: '모바일', value: d.devices.mobile },
                { key: 'desktop', label: 'PC', value: d.devices.desktop, tone: 'soft' },
              ]}
            />
          </Panel>
          <Panel title="가입 경로" description="간편로그인별 신규 가입">
            {d.signupsByProvider.length === 0 ? (
              <EmptyState compact icon="user" title="신규 가입이 없어요" />
            ) : (
              <BarList
                label="간편로그인별 신규 가입"
                unit="명"
                items={d.signupsByProvider.map((p) => ({
                  key: p.provider,
                  label: AUTH_PROVIDER_LABEL[p.provider],
                  value: p.count,
                }))}
              />
            )}
          </Panel>
        </div>
      </div>

      <div className={cx(styles.row, styles.half)}>
        <Panel title="많이 본 화면" description="페이지뷰 순">
          {d.topPages.length === 0 ? (
            <EmptyState compact icon="eye" title="집계된 화면이 없어요" />
          ) : (
            <BarList
              label="많이 본 화면"
              unit="회"
              items={d.topPages.map((p) => ({
                key: p.path,
                label: p.label,
                sub: p.path,
                value: p.pageViews,
              }))}
            />
          )}
        </Panel>
        <DailyTable
          name="방문·가입"
          points={d.points}
          columns={[
            { header: '방문자', value: (p) => p.visitors },
            { header: '페이지뷰', value: (p) => p.pageViews },
            { header: '신규 가입', value: (p) => p.signups },
          ]}
        />
      </div>
    </>
  );
}

// ---------- 매물 ----------

type ListingPoint = ListingStats['points'][number];
type TopComplex = ListingStats['topComplexes'][number];
const LISTING_METRICS: [Metric<ListingPoint>, ...Metric<ListingPoint>[]] = [
  { key: 'created', label: '신규 등록', unit: '건', value: (r) => total(r, (p) => p.created) },
  { key: 'closed', label: '거래 완료·종료', unit: '건', value: (r) => total(r, (p) => p.closed) },
];

export function ListingsSection({ days, dev }: SectionProps) {
  const params = { days, ...dev };
  const query = useQuery({
    queryKey: qk('admin-stats', 'listings', params),
    queryFn: ({ signal }) => stats.listings(params, { signal }),
    placeholderData: keepPreviousData,
  });
  if (!query.data)
    return (
      <SectionState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  const d = query.data;
  const created = total(d.points, (p) => p.created);
  const closed = total(d.points, (p) => p.closed);
  const none = d.points.length === 0;

  const complexColumns: TableColumn<TopComplex>[] = [
    {
      key: 'rank',
      header: '순위',
      width: 56,
      cell: (_c, i) => <span className={cx(styles.rank, i < 3 && styles.rankTop)}>{i + 1}</span>,
    },
    {
      key: 'name',
      header: '단지',
      cell: (c) => (
        <Link href={`${ADMIN_ROUTES.complexes}/${c.id}`} className="link">
          {c.name}
        </Link>
      ),
    },
    {
      key: 'views',
      header: '조회',
      align: 'right',
      cell: (c) => <span className={styles.barValue}>{formatCount(c.views)}</span>,
    },
    {
      key: 'listings',
      header: '게시 매물',
      align: 'right',
      cell: (c) => <span className={styles.barValue}>{formatCount(c.listings)}</span>,
    },
  ];

  return (
    <>
      <div className={styles.kpis}>
        <Kpi
          label="신규 등록"
          value={none ? '–' : formatCount(created)}
          unit={none ? undefined : '건'}
          current={none ? undefined : created}
          previous={d.previous.created}
          days={days}
          icon="plus"
          brand
        />
        <Kpi
          label="거래 완료·종료"
          value={none ? '–' : formatCount(closed)}
          unit={none ? undefined : '건'}
          current={none ? undefined : closed}
          previous={d.previous.closed}
          days={days}
          icon="check-circle"
        />
        <Kpi
          label="순증"
          value={none ? '–' : signed(created - closed)}
          unit={none ? undefined : '건'}
          days={days}
          icon="swap"
          note={<span className={styles.vs}>신규 등록 − 종료</span>}
        />
        <Kpi
          label="게시 중 매물"
          value={formatCount(d.activeTotal)}
          unit="건"
          days={days}
          icon="building"
          note={<span className={styles.vs}>지금 기준 · 숨김 제외</span>}
        />
      </div>

      <div className={styles.row}>
        <TrendPanel
          title="매물 등록 추이"
          points={d.points}
          metrics={LISTING_METRICS}
          days={days}
        />
        <div className={styles.side}>
          <Panel title="거래 유형별" description="게시 중 매물">
            <BarList
              label="거래 유형별 게시 매물"
              unit="건"
              items={d.byDealType.map((t) => ({
                key: t.dealType,
                label: DEAL_TYPE_LABEL[t.dealType],
                value: t.count,
                tone: DEAL_TONE[t.dealType],
              }))}
            />
          </Panel>
          <Panel title="매물 종류별" description="게시 중 매물">
            <BarList
              label="매물 종류별 게시 매물"
              unit="건"
              items={d.byAssetType.map((t) => ({
                key: t.assetType,
                label: ASSET_TYPE_LABEL[t.assetType],
                value: t.count,
              }))}
            />
          </Panel>
        </div>
      </div>

      <div className={cx(styles.row, styles.half)}>
        <Panel title="조회 많은 단지" description={`최근 ${days}일`} flush>
          <Table
            bare
            density="compact"
            caption="조회 많은 단지"
            columns={complexColumns}
            rows={d.topComplexes}
            rowKey={(c) => c.id}
            empty={<EmptyState compact icon="layers" title="집계된 단지가 없어요" />}
          />
        </Panel>
        <DailyTable
          name="매물"
          points={d.points}
          columns={[
            { header: '신규 등록', value: (p) => p.created },
            { header: '거래 완료·종료', value: (p) => p.closed },
            { header: '순증', value: (p) => p.created - p.closed, format: signed },
          ]}
        />
      </div>
    </>
  );
}

// ---------- 내놓기 · 구하기 ----------

type RequestPoint = DealRequestStats['points'][number];
const REQUEST_METRICS: [Metric<RequestPoint>, ...Metric<RequestPoint>[]] = [
  { key: 'all', label: '전체 요청', unit: '건', value: (r) => total(r, (p) => p.sell + p.find) },
  { key: 'sell', label: '내놓기', unit: '건', value: (r) => total(r, (p) => p.sell) },
  { key: 'find', label: '구하기', unit: '건', value: (r) => total(r, (p) => p.find) },
  {
    key: 'proposals',
    label: '중개사 제안',
    unit: '건',
    value: (r) => total(r, (p) => p.proposals),
  },
];

export function DealRequestsSection({ days, dev }: SectionProps) {
  const params = { days, ...dev };
  const query = useQuery({
    queryKey: qk('admin-stats', 'deal-requests', params),
    queryFn: ({ signal }) => stats.dealRequests(params, { signal }),
    placeholderData: keepPreviousData,
  });
  if (!query.data)
    return (
      <SectionState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  const d = query.data;
  const sell = total(d.points, (p) => p.sell);
  const find = total(d.points, (p) => p.find);
  const proposals = total(d.points, (p) => p.proposals);
  const perRequest = ratio(proposals, sell + find);
  const prevPerRequest = ratio(d.previous.proposals, d.previous.sell + d.previous.find);
  const none = d.points.length === 0;

  return (
    <>
      <div className={styles.kpis}>
        <Kpi
          label="내놓기 요청"
          value={none ? '–' : formatCount(sell)}
          unit={none ? undefined : '건'}
          current={none ? undefined : sell}
          previous={d.previous.sell}
          days={days}
          icon="home-up"
          brand
        />
        <Kpi
          label="구하기 요청"
          value={none ? '–' : formatCount(find)}
          unit={none ? undefined : '건'}
          current={none ? undefined : find}
          previous={d.previous.find}
          days={days}
          icon="home-search"
        />
        <Kpi
          label="중개사 제안"
          value={none ? '–' : formatCount(proposals)}
          unit={none ? undefined : '건'}
          current={none ? undefined : proposals}
          previous={d.previous.proposals}
          days={days}
          icon="chat"
        />
        <Kpi
          label="요청당 제안"
          value={none ? '–' : perRequest.toFixed(1)}
          unit={none ? undefined : '건'}
          current={none ? undefined : perRequest}
          previous={prevPerRequest}
          days={days}
          icon="store"
        />
      </div>

      <div className={styles.row}>
        <TrendPanel title="요청 추이" points={d.points} metrics={REQUEST_METRICS} days={days} />
        <div className={styles.side}>
          <Panel title="응답 품질" description="중개사무소의 제안 속도">
            <div className={styles.quality}>
              <div className={styles.q}>
                <span className={styles.qLabel}>제안을 받은 요청</span>
                <span className={styles.qValue}>
                  {d.responseRate === null ? '–' : formatPercent(d.responseRate, 0)}
                </span>
              </div>
              <div className={styles.q}>
                <span className={styles.qLabel}>첫 제안까지 평균</span>
                <span className={styles.qValue}>
                  {d.avgFirstResponseMinutes === null
                    ? '–'
                    : formatMinutes(d.avgFirstResponseMinutes)}
                </span>
              </div>
            </div>
          </Panel>
          <Panel title="지역별 요청" description="내놓기 + 구하기">
            {d.byRegion.length === 0 ? (
              <EmptyState compact icon="map-pin" title="요청이 없어요" />
            ) : (
              <BarList
                label="지역별 요청"
                unit="건"
                items={d.byRegion.map((r) => ({ key: r.name, label: r.name, value: r.count }))}
              />
            )}
          </Panel>
        </div>
      </div>

      <DailyTable
        name="내놓기·구하기"
        points={d.points}
        columns={[
          { header: '내놓기', value: (p) => p.sell },
          { header: '구하기', value: (p) => p.find },
          { header: '중개사 제안', value: (p) => p.proposals },
        ]}
      />
    </>
  );
}

// ---------- 광고 ----------

type AdPoint = AdStats['points'][number];
type SlotRow = AdStats['bySlot'][number];
const ctrOf = (rows: readonly { impressions: number; clicks: number }[]) =>
  ratio(
    total(rows, (p) => p.clicks),
    total(rows, (p) => p.impressions),
  ) * 100;
const AD_METRICS: [Metric<AdPoint>, ...Metric<AdPoint>[]] = [
  { key: 'impressions', label: '노출', unit: '회', value: (r) => total(r, (p) => p.impressions) },
  { key: 'clicks', label: '클릭', unit: '회', value: (r) => total(r, (p) => p.clicks) },
  { key: 'ctr', label: '클릭률', unit: '%', value: ctrOf, format: fixed(2) },
];

export function AdsSection({ days, dev }: SectionProps) {
  const params = { days, ...dev };
  const query = useQuery({
    queryKey: qk('admin-stats', 'ads', params),
    queryFn: ({ signal }) => stats.ads(params, { signal }),
    placeholderData: keepPreviousData,
  });
  if (!query.data)
    return (
      <SectionState
        isPending={query.isPending}
        error={query.error}
        onRetry={() => void query.refetch()}
      />
    );
  const d = query.data;
  const impressions = total(d.points, (p) => p.impressions);
  const clicks = total(d.points, (p) => p.clicks);
  const ctr = ctrOf(d.points);
  const prevCtr = ctrOf([d.previous]);
  const none = d.points.length === 0;

  const slotColumns: TableColumn<SlotRow>[] = [
    { key: 'slot', header: '배너 위치', cell: (r) => r.label },
    {
      key: 'impressions',
      header: '노출',
      align: 'right',
      cell: (r) => <span className={styles.barValue}>{formatCount(r.impressions)}</span>,
    },
    {
      key: 'clicks',
      header: '클릭',
      align: 'right',
      cell: (r) => <span className={styles.barValue}>{formatCount(r.clicks)}</span>,
    },
    {
      key: 'ctr',
      header: '클릭률',
      align: 'right',
      cell: (r) => (
        <span className={styles.barValue}>{formatPercent(ratio(r.clicks, r.impressions), 2)}</span>
      ),
    },
  ];

  return (
    <>
      <div className={styles.kpis}>
        <Kpi
          label="배너 노출"
          value={none ? '–' : formatCount(impressions)}
          unit={none ? undefined : '회'}
          current={none ? undefined : impressions}
          previous={d.previous.impressions}
          days={days}
          icon="eye"
          brand
        />
        <Kpi
          label="클릭"
          value={none ? '–' : formatCount(clicks)}
          unit={none ? undefined : '회'}
          current={none ? undefined : clicks}
          previous={d.previous.clicks}
          days={days}
          icon="external-link"
        />
        <Kpi
          label="클릭률 (CTR)"
          value={none ? '–' : ctr.toFixed(2)}
          unit={none ? undefined : '%'}
          current={none ? undefined : ctr}
          previous={prevCtr}
          days={days}
          icon="chart"
        />
        <Kpi
          label="게시 중 배너"
          value={formatCount(d.activeBanners)}
          unit="개"
          days={days}
          icon="megaphone"
          note={
            <Link href={ADMIN_ROUTES.banners} className="link">
              배너·팝업 관리
            </Link>
          }
        />
      </div>

      <div className={styles.row}>
        <TrendPanel title="광고 성과 추이" points={d.points} metrics={AD_METRICS} days={days} />
        <div className={styles.side}>
          <Panel title="위치별 클릭" description={`최근 ${days}일`}>
            {d.bySlot.length === 0 ? (
              <EmptyState compact icon="megaphone" title="집계된 배너가 없어요" />
            ) : (
              <BarList
                label="배너 위치별 클릭"
                unit="회"
                items={[...d.bySlot]
                  .sort((a, b) => b.clicks - a.clicks)
                  .map((r) => ({ key: r.slot, label: r.label, value: r.clicks }))}
              />
            )}
          </Panel>
        </div>
      </div>

      <div className={cx(styles.row, styles.half)}>
        <Panel title="위치별 성과" description="노출 순" flush>
          <Table
            bare
            density="compact"
            caption="배너 위치별 성과"
            columns={slotColumns}
            rows={[...d.bySlot].sort((a, b) => b.impressions - a.impressions)}
            rowKey={(r) => r.slot}
            empty={<EmptyState compact icon="megaphone" title="집계된 배너가 없어요" />}
          />
        </Panel>
        <DailyTable
          name="광고"
          points={d.points}
          columns={[
            { header: '노출', value: (p) => p.impressions },
            { header: '클릭', value: (p) => p.clicks },
            {
              header: '클릭률(%)',
              value: (p) => Number((ratio(p.clicks, p.impressions) * 100).toFixed(2)),
              format: fixed(2),
            },
          ]}
        />
      </div>
    </>
  );
}
