'use client';
import { ASSET_TYPE_LABEL, AssetType } from '@house/shared';
import {
  Badge,
  Button,
  EmptyState,
  Icon,
  ListSearchField,
  Panel,
  Select,
  Spinner,
  type TableColumn,
  type TableSort,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { ADMIN_ROUTES } from '@/config/nav';
import { qk } from '@/lib/api';
import { formatCount, formatDateShort, formatDateTime, formatRelativeTime } from '@/lib/format';
import { complexes } from '../api';
import { useDevQuery } from '../api/dev';
import { regionLabel, useRegions } from '../api/regions';
import type { ComplexSummary } from '../api/schemas';
import { DataTable, ListFooter, cardStyles } from '../components/DataTable';
import { LoadError } from '../components/LoadError';
import s from '../components/shared.module.css';
import { TRADE_SYNC_KIND_LABEL, formatYearMonthInt } from '../lib/labels';
import { useUrlState } from '../lib/use-url-state';
import { ComplexesTabs, TRADE_SYNC_ROUTE } from './ComplexesTabs';
import styles from './complexes.module.css';

const PAGE_SIZE = 10;

function SyncStrip() {
  const runs = useQuery({
    queryKey: qk('admin-trade-sync', 'latest'),
    queryFn: ({ signal }) => complexes.syncRuns({ pageSize: 2 }, { signal }),
  });
  const latest = runs.data?.items[0];
  return (
    <div className={styles.syncStrip}>
      <span className={styles.syncIcon}>
        <Icon name="refresh" size={18} />
      </span>
      <div className={styles.syncText}>
        <b>실거래가 동기화</b>
        {runs.isPending ? (
          <span className={s.muted}>최근 내역을 확인하고 있어요…</span>
        ) : !latest ? (
          <span className={s.muted}>
            {runs.isError ? '최근 내역을 불러오지 못했어요.' : '아직 동기화한 적이 없어요.'}
          </span>
        ) : (
          <>
            <span>
              {formatYearMonthInt(latest.yearMonth)} {TRADE_SYNC_KIND_LABEL[latest.kind]} ·{' '}
              {formatDateTime(latest.startedAt)}
            </span>
            {latest.status === 'RUNNING' ? (
              <span className={styles.running}>
                <Spinner size={14} /> 진행 중
              </span>
            ) : latest.status === 'FAILED' ? (
              <Badge tone="danger">실패</Badge>
            ) : (
              <Badge tone="success">완료 · 반영 {formatCount(latest.upsertedCount)}건</Badge>
            )}
          </>
        )}
      </div>
      <Link href={TRADE_SYNC_ROUTE} className={styles.syncLink}>
        동기화 내역
        <Icon name="chevron-right" size={16} />
      </Link>
    </div>
  );
}

export function ComplexesView() {
  const router = useRouter();
  const dev = useDevQuery();
  const regions = useRegions();
  const [url, setUrl] = useUrlState({
    q: '',
    emdCode: '',
    missing: '',
    sort: 'updatedAt',
    dir: 'desc',
    page: '1',
  });

  const params = { ...url, page: Number(url.page) || 1, pageSize: PAGE_SIZE, ...dev };
  const list = useQuery({
    queryKey: qk('admin-complexes', 'list', params),
    queryFn: ({ signal }) => complexes.list(params, { signal }),
    placeholderData: keepPreviousData,
  });
  const data = list.data;
  const sort: TableSort = { key: url.sort, dir: url.dir === 'asc' ? 'asc' : 'desc' };
  const filtered = url.q !== '' || url.emdCode !== '' || url.missing !== '';
  const href = (c: ComplexSummary) => `${ADMIN_ROUTES.complexes}/${c.id}`;

  const nameCell = (c: ComplexSummary) => (
    <div className={s.cellMain}>
      <span className={s.cellTitle}>
        <Link href={href(c)} className={s.clamp1}>
          {c.name}
        </Link>
        {c.assetType !== AssetType.APT && <Badge>{ASSET_TYPE_LABEL[c.assetType]}</Badge>}
      </span>
      <span className={`${s.cellSub} ${s.clamp1}`}>
        {c.roadAddress ?? c.jibunAddress ?? c.emdName ?? '주소 미입력'}
      </span>
    </div>
  );
  const gaps = (c: ComplexSummary) => (
    <>
      {c.areaTypeCount === 0 && <Badge tone="warn">평형 없음</Badge>}
      {c.photoCount === 0 && <Badge tone="warn">사진 없음</Badge>}
    </>
  );

  const columns: TableColumn<ComplexSummary>[] = [
    { key: 'name', header: '단지 · 주소', sortable: true, cell: nameCell },
    {
      key: 'households',
      header: '세대수',
      align: 'right',
      sortable: true,
      width: 96,
      cell: (c) => <span className={s.num}>{c.households ? formatCount(c.households) : '–'}</span>,
    },
    {
      key: 'builtYear',
      header: '준공',
      align: 'right',
      sortable: true,
      width: 84,
      cell: (c) => <span className={s.num}>{c.builtYear ?? '–'}</span>,
    },
    {
      key: 'data',
      header: '평형 · 사진',
      width: 150,
      cell: (c) =>
        c.areaTypeCount === 0 || c.photoCount === 0 ? (
          <span className={s.filters}>{gaps(c)}</span>
        ) : (
          <span>
            평형 <b className={s.num}>{c.areaTypeCount}</b> · 사진{' '}
            <b className={s.num}>{c.photoCount}</b>
          </span>
        ),
    },
    {
      key: 'listings',
      header: '매물',
      align: 'right',
      sortable: true,
      width: 80,
      cell: (c) => <span className={s.num}>{formatCount(c.activeListingCount)}</span>,
    },
    {
      key: 'views',
      header: '조회',
      align: 'right',
      sortable: true,
      width: 88,
      cell: (c) => <span className={s.num}>{formatCount(c.viewCount)}</span>,
    },
    {
      key: 'lastTrade',
      header: '최근 실거래',
      width: 112,
      cell: (c) =>
        c.lastTradeDate ? (
          <span className={s.num}>{formatDateShort(c.lastTradeDate)}</span>
        ) : (
          <span className={s.muted}>거래 없음</span>
        ),
    },
    {
      key: 'updatedAt',
      header: '수정',
      sortable: true,
      width: 100,
      cell: (c) => <span className={s.muted}>{formatRelativeTime(c.updatedAt)}</span>,
    },
  ];

  return (
    <>
      <div className={s.bar}>
        <ComplexesTabs current="list" />
        <div className={s.barEnd}>
          <Button
            href={`${ADMIN_ROUTES.complexes}/new`}
            linkAs={Link}
            iconLeft={<Icon name="plus" size={18} />}
          >
            단지 등록
          </Button>
        </div>
      </div>
      <SyncStrip />

      <Panel
        title="단지 목록"
        count={data?.total}
        flush
        actions={
          <div className={s.filters}>
            <ListSearchField
              className={s.search}
              label="단지명·주소 검색"
              placeholder="단지명, 주소 검색"
              value={url.q}
              onSearch={(q) => setUrl({ q })}
            />
            <div className={s.selectSm}>
              <Select
                aria-label="지역"
                value={url.emdCode}
                onChange={(e) => setUrl({ emdCode: e.target.value })}
                options={[
                  { value: '', label: '지역 전체' },
                  ...(regions.data ?? []).map((r) => ({ value: r.code, label: regionLabel(r) })),
                ]}
              />
            </div>
            <div className={s.selectSm}>
              <Select
                aria-label="보완이 필요한 단지"
                value={url.missing}
                onChange={(e) => setUrl({ missing: e.target.value })}
                options={[
                  { value: '', label: '정보 상태 전체' },
                  { value: 'photos', label: '사진 없음' },
                  { value: 'areaTypes', label: '평형 없음' },
                ]}
              />
            </div>
          </div>
        }
        footer={
          data && data.total > 0 ? (
            <ListFooter
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPage={(page) => setUrl({ page: String(page) })}
              unit="곳"
            />
          ) : undefined
        }
      >
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            caption="단지 목록"
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(c) => c.id}
            loading={list.isPending}
            loadingRows={8}
            sort={sort}
            onSortChange={(next) => setUrl({ sort: next.key, dir: next.dir })}
            onRowClick={(c) => router.push(href(c))}
            empty={
              filtered ? (
                <EmptyState
                  compact
                  title="조건에 맞는 단지가 없어요"
                  description="검색어나 필터를 바꿔 보세요."
                />
              ) : (
                <EmptyState
                  compact
                  icon="layers"
                  title="등록된 단지가 없어요"
                  description="단지를 등록하면 매물과 실거래가가 단지에 묶여 보여요."
                  action={
                    <Button size="sm" href={`${ADMIN_ROUTES.complexes}/new`} linkAs={Link}>
                      단지 등록
                    </Button>
                  }
                />
              )
            }
            card={(c) => (
              <>
                {nameCell(c)}
                <div className={cardStyles.cardMeta}>
                  <span>
                    {c.households ? `${formatCount(c.households)}세대` : '세대수 미입력'}
                    {c.builtYear ? ` · ${c.builtYear}년` : ''}
                  </span>
                  <span>매물 {formatCount(c.activeListingCount)}</span>
                  <span>조회 {formatCount(c.viewCount)}</span>
                  {gaps(c)}
                </div>
              </>
            )}
          />
        )}
      </Panel>
    </>
  );
}
