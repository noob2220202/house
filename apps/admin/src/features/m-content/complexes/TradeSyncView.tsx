'use client';
import { AdminRole, type TradeSyncStatus } from '@house/shared';
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  Icon,
  Input,
  Panel,
  SegmentedControl,
  Spinner,
  StatTile,
  StatusPill,
  useToast,
  type TableColumn,
} from '@house/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, errorMessage, qk } from '@/lib/api';
import { useAdminSession } from '@/lib/auth';
import { formatCount, formatDateTime, formatRelativeTime } from '@/lib/format';
import { complexes } from '../api';
import { useDevQuery } from '../api/dev';
import type { TradeSyncRun } from '../api/schemas';
import { DataTable, ListFooter, cardStyles } from '../components/DataTable';
import { LoadError } from '../components/LoadError';
import s from '../components/shared.module.css';
import {
  TRADE_SYNC_KIND_LABEL,
  TRADE_SYNC_STATUS_LABEL,
  formatYearMonthInt,
  inputToYm,
  ymToInput,
} from '../lib/labels';
import { durationLabel, nextScheduledRun, previousYearMonth } from '../lib/trade-sync';
import { useUrlState } from '../lib/use-url-state';
import { ComplexBootstrapCard } from './ComplexBootstrapCard';
import { ComplexesTabs } from './ComplexesTabs';
import styles from './complexes.module.css';

type StatusFilter = 'all' | TradeSyncStatus;
const TONE = { RUNNING: 'scheduled', SUCCEEDED: 'live', FAILED: 'rejected' } as const;

export function TradeSyncView() {
  const { toast } = useToast();
  const { can } = useAdminSession();
  const queryClient = useQueryClient();
  const dev = useDevQuery();
  const [url, setUrl] = useUrlState({ status: 'all', page: '1' });
  const [month, setMonth] = useState(() => ymToInput(previousYearMonth(new Date())));
  const [confirm, setConfirm] = useState(false);
  const canTrigger = can(AdminRole.ADMIN);

  const params = {
    status: url.status === 'all' ? undefined : url.status,
    page: Number(url.page) || 1,
    pageSize: 10,
    ...dev,
  };
  const runs = useQuery({
    queryKey: qk('admin-trade-sync', 'runs', params),
    queryFn: ({ signal }) => complexes.syncRuns(params, { signal }),
    placeholderData: keepPreviousData,
    // Poll while a run is in progress.
    refetchInterval: (query) =>
      query.state.data?.items.some((r) => r.status === 'RUNNING') ? 2000 : false,
  });
  const overview = useQuery({
    queryKey: qk('admin-trade-sync', 'overview'),
    queryFn: ({ signal }) => complexes.syncRuns({ pageSize: 30 }, { signal }),
    refetchInterval: (query) =>
      query.state.data?.items.some((r) => r.status === 'RUNNING') ? 2000 : false,
  });
  const ym = inputToYm(month);
  const trigger = useMutation({
    mutationFn: () => complexes.triggerSync(ym ?? 0),
    onSuccess: () => {
      setConfirm(false);
      toast(`${formatYearMonthInt(ym ?? 0)} 실거래가 동기화를 시작했어요.`);
      setUrl({ status: 'all', page: '1' });
      void queryClient.invalidateQueries({ queryKey: ['admin-trade-sync'] });
    },
    onError: (e) => {
      setConfirm(false);
      toast({ message: errorMessage(e), tone: 'error' });
      if (e instanceof ApiError && e.status === 409)
        void queryClient.invalidateQueries({ queryKey: ['admin-trade-sync'] });
    },
  });

  const recent = overview.data?.items ?? [];
  const running = recent.filter((r) => r.status === 'RUNNING');
  const lastDone = recent.find((r) => r.status === 'SUCCEEDED');
  const failed = recent.filter((r) => r.status === 'FAILED');
  const latestYm = lastDone?.yearMonth;
  const latestUpserts = recent
    .filter((r) => r.status === 'SUCCEEDED' && r.yearMonth === latestYm)
    .reduce((acc, r) => acc + r.upsertedCount, 0);
  const data = runs.data;

  const statusPill = (r: TradeSyncRun) =>
    r.status === 'RUNNING' ? (
      <span className={styles.running}>
        <Spinner size={14} />
        <StatusPill tone="scheduled">진행 중</StatusPill>
      </span>
    ) : (
      <StatusPill tone={TONE[r.status]}>{TRADE_SYNC_STATUS_LABEL[r.status]}</StatusPill>
    );
  const targetCell = (r: TradeSyncRun) => (
    <div className={s.cellMain}>
      <span className={s.cellTitle}>
        {formatYearMonthInt(r.yearMonth)} · {TRADE_SYNC_KIND_LABEL[r.kind]}
      </span>
      {r.error ? (
        <span className={styles.runError}>{r.error}</span>
      ) : (
        <span className={s.cellSub}>
          {r.triggeredByAdminName ? `${r.triggeredByAdminName} 님이 수동 실행` : '정기 실행'}
        </span>
      )}
    </div>
  );
  const countCell = (value: number, r: TradeSyncRun) =>
    r.status === 'RUNNING' ? (
      <span className={s.muted}>–</span>
    ) : (
      <span className={s.num}>{formatCount(value)}</span>
    );

  const columns: TableColumn<TradeSyncRun>[] = [
    { key: 'target', header: '대상 · 실행 방식', cell: targetCell },
    { key: 'status', header: '상태', width: 130, cell: statusPill },
    {
      key: 'fetched',
      header: '조회',
      align: 'right',
      width: 84,
      cell: (r) => countCell(r.fetchedCount, r),
    },
    {
      key: 'upserted',
      header: '신규·변경',
      align: 'right',
      width: 96,
      cell: (r) => countCell(r.upsertedCount, r),
    },
    {
      key: 'matched',
      header: '단지 매칭',
      align: 'right',
      width: 96,
      cell: (r) => countCell(r.matchedCount, r),
    },
    {
      key: 'startedAt',
      header: '시작',
      width: 150,
      cell: (r) => <span className={s.num}>{formatDateTime(r.startedAt)}</span>,
    },
    {
      key: 'duration',
      header: '소요',
      align: 'right',
      width: 80,
      cell: (r) => <span className={s.muted}>{durationLabel(r.startedAt, r.finishedAt)}</span>,
    },
  ];

  return (
    <>
      <div className={s.bar}>
        <ComplexesTabs current="sync" />
      </div>

      <div className={styles.kpis}>
        <StatTile
          label="최근 완료"
          value={lastDone ? formatRelativeTime(lastDone.finishedAt ?? lastDone.startedAt) : '–'}
          detail={
            lastDone
              ? `${formatYearMonthInt(lastDone.yearMonth)} ${TRADE_SYNC_KIND_LABEL[lastDone.kind]}`
              : overview.isPending
                ? '확인 중'
                : '완료된 동기화가 없어요'
          }
          icon={<Icon name="check-circle" size={18} />}
          iconTone="brand"
        />
        <StatTile
          label={latestYm ? `${formatYearMonthInt(latestYm)} 반영` : '반영 건수'}
          value={latestYm ? formatCount(latestUpserts) : '–'}
          unit={latestYm ? '건' : undefined}
          detail="신규·변경된 실거래 (매매 + 전월세)"
          icon={<Icon name="chart" size={18} />}
        />
        <StatTile
          label="다음 정기 실행"
          value={nextScheduledRun(new Date())}
          detail="매월 1일 04:00 · 전월 신고분"
          icon={<Icon name="calendar" size={18} />}
        />
        <StatTile
          label="최근 실패"
          value={formatCount(failed.length)}
          unit="건"
          detail={
            failed[0]
              ? `${formatYearMonthInt(failed[0].yearMonth)} ${TRADE_SYNC_KIND_LABEL[failed[0].kind]}`
              : '최근 30회 실행 기준'
          }
          icon={<Icon name="alert" size={18} />}
          iconTone={failed.length > 0 ? 'accent' : 'neutral'}
        />
      </div>

      {failed.length > 0 && (
        <Callout size="sm" tone="warn">
          실패한 실행이 있어요. 공공데이터포털 응답 지연이 원인인 경우가 많으니, 해당 월을 골라 수동
          동기화를 다시 실행해 주세요. <Badge tone="warn">실패 {failed.length}건</Badge>
        </Callout>
      )}

      <ComplexBootstrapCard canRun={canTrigger} />

      <Panel
        title="수동 동기화"
        description="국토교통부 실거래가 공개시스템(data.go.kr)에서 다시 가져와요"
      >
        {canTrigger ? (
          <div className={styles.triggerRow}>
            <div className={styles.monthField}>
              <Input
                label="대상 월"
                type="month"
                value={month}
                max={ymToInput(previousYearMonth(new Date(), 0))}
                min="2006-01"
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
            <Button
              iconLeft={<Icon name="refresh" size={18} />}
              disabled={ym === null || running.length > 0}
              onClick={() => setConfirm(true)}
            >
              {running.length > 0 ? '동기화 진행 중' : '동기화 실행'}
            </Button>
            <p className={styles.triggerNote}>
              아파트 매매와 전월세 자료를 각각 가져와요. 같은 거래는 한 번만 저장되므로 여러 번
              실행해도 중복되지 않고, 계약 해제된 거래는 &lsquo;해제&rsquo;로 바뀌어요.
            </p>
          </div>
        ) : (
          <Callout size="sm" tone="muted" icon="lock">
            수동 동기화는 관리자 권한부터 실행할 수 있어요. 실행 내역은 아래에서 볼 수 있어요.
          </Callout>
        )}
      </Panel>

      <Panel
        title="실행 내역"
        count={data?.total}
        flush
        actions={
          <SegmentedControl<StatusFilter>
            label="상태"
            size="sm"
            value={url.status as StatusFilter}
            onChange={(status) => setUrl({ status })}
            options={[
              { value: 'all', label: '전체' },
              { value: 'SUCCEEDED', label: '완료' },
              { value: 'FAILED', label: '실패' },
              { value: 'RUNNING', label: '진행 중' },
            ]}
          />
        }
        footer={
          data && data.total > 0 ? (
            <ListFooter
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              totalPages={data.totalPages}
              onPage={(page) => setUrl({ page: String(page) })}
              unit="건"
              note="최신순"
            />
          ) : undefined
        }
      >
        {runs.isError ? (
          <LoadError error={runs.error} onRetry={() => void runs.refetch()} />
        ) : (
          <DataTable
            caption="실거래가 동기화 실행 내역"
            columns={columns}
            rows={data?.items ?? []}
            rowKey={(r) => r.id}
            loading={runs.isPending}
            empty={
              <EmptyState
                compact
                icon="refresh"
                title={
                  url.status === 'all' ? '실행 내역이 없어요' : '해당 상태의 실행 내역이 없어요'
                }
                description={
                  url.status === 'all' ? '정기 실행은 매월 1일 새벽 4시에 시작해요.' : undefined
                }
              />
            }
            card={(r) => (
              <>
                <div className={cardStyles.cardRow}>
                  {targetCell(r)}
                  {statusPill(r)}
                </div>
                <div className={cardStyles.cardMeta}>
                  <span>{formatDateTime(r.startedAt)}</span>
                  {r.status !== 'RUNNING' && (
                    <>
                      <span>조회 {formatCount(r.fetchedCount)}</span>
                      <span>반영 {formatCount(r.upsertedCount)}</span>
                      <span>매칭 {formatCount(r.matchedCount)}</span>
                    </>
                  )}
                </div>
              </>
            )}
          />
        )}
      </Panel>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => trigger.mutate()}
        title={`${ym ? formatYearMonthInt(ym) : ''} 실거래가를 동기화할까요?`}
        description="아파트 매매·전월세 자료를 공공데이터포털에서 다시 가져와요. 보통 1분 안에 끝나고, 끝나면 단지별 시세 통계가 다시 계산돼요."
        confirmLabel="동기화 실행"
        loading={trigger.isPending}
      />
    </>
  );
}
