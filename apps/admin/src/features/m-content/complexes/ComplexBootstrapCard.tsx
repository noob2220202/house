'use client';
import {
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  EmptyState,
  Icon,
  Panel,
  Select,
  StatTile,
  useToast,
  type TableColumn,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { ApiError, errorMessage, qk } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { complexes } from '../api';
import type { BootstrapItem, BootstrapJob } from '../api/schemas';
import { DataTable, cardStyles } from '../components/DataTable';
import s from '../components/shared.module.css';
import { formatYearMonthInt } from '../lib/labels';
import styles from './complexes.module.css';

/** 계약월 기간 options (API: 12–240 months, default 60 = 5년). */
export const BOOTSTRAP_MONTH_OPTIONS = [
  { value: '12', label: '최근 1년' },
  { value: '36', label: '최근 3년' },
  { value: '60', label: '최근 5년 (권장)' },
  { value: '120', label: '최근 10년' },
  { value: '240', label: '최근 20년' },
] as const;

/** 단지 list filtered to the 단지 the bootstrap created. */
export const BOOTSTRAP_LIST_HREF = `${ADMIN_ROUTES.complexes}?source=TRADE_BOOTSTRAP`;

const PHASE_LABEL: Record<BootstrapJob['progress']['phase'], string> = {
  queued: '작업 순서를 기다리고 있어요',
  fetch: '실거래가 자료를 불러오고 있어요',
  geocode: '새 단지의 좌표를 찾고 있어요',
  write: '단지를 저장하고 있어요',
  done: '마무리하고 있어요',
};

const ACTION_LABEL: Record<
  BootstrapItem['action'],
  { label: string; tone: 'brand' | 'success' | 'warn' | 'neutral' | 'danger' }
> = {
  CREATE: { label: '새로 만듦', tone: 'brand' },
  UPDATE: { label: '빈 정보 보완', tone: 'success' },
  UNCHANGED: { label: '이미 있음', tone: 'neutral' },
  NEEDS_LOCATION: { label: '좌표 확인 필요', tone: 'warn' },
  SKIP: { label: '제외', tone: 'neutral' },
};

const isRunning = (job: BootstrapJob | null | undefined) =>
  !!job && job.status !== 'completed' && job.status !== 'failed';

function ProgressBlock({ job }: { job: BootstrapJob }) {
  const { phase, done, total, percent } = job.progress;
  const unit =
    phase === 'fetch' ? '회 조회' : phase === 'geocode' ? '곳' : phase === 'write' ? '곳' : '';
  return (
    <div className={styles.bootProgress}>
      <div className={styles.bootProgressHead}>
        <span>
          {job.dryRun ? '미리보기' : '단지 만들기'} · {PHASE_LABEL[phase]}
        </span>
        <span className={s.num}>{percent}%</span>
      </div>
      <div
        className={styles.bootBar}
        role="progressbar"
        aria-label="단지 만들기 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      {total > 0 && unit && (
        <span className={s.muted}>
          {formatCount(done)} / {formatCount(total)}
          {unit}
        </span>
      )}
    </div>
  );
}

function ItemsTable({ items, caption }: { items: BootstrapItem[]; caption: string }) {
  const nameCell = (i: BootstrapItem) => (
    <div className={s.cellMain}>
      <span className={s.cellTitle}>{i.name}</span>
      <span className={`${s.cellSub} ${s.clamp1}`}>
        {i.reason ?? i.roadAddress ?? i.jibunAddress ?? '주소 없음'}
      </span>
    </div>
  );
  const actionBadge = (i: BootstrapItem) => (
    <Badge tone={ACTION_LABEL[i.action].tone}>{ACTION_LABEL[i.action].label}</Badge>
  );
  const columns: TableColumn<BootstrapItem>[] = [
    { key: 'name', header: '단지명', cell: nameCell },
    { key: 'emd', header: '동', width: 130, cell: (i) => i.emdName ?? '–' },
    {
      key: 'built',
      header: '준공',
      align: 'right',
      width: 72,
      cell: (i) => <span className={s.num}>{i.builtYear ?? '–'}</span>,
    },
    {
      key: 'areas',
      header: '평형 수',
      align: 'right',
      width: 80,
      cell: (i) => <span className={s.num}>{formatCount(i.areaTypeCount)}</span>,
    },
    {
      key: 'location',
      header: '좌표',
      width: 84,
      cell: (i) => (i.hasLocation ? '있음' : <Badge tone="warn">없음</Badge>),
    },
    { key: 'action', header: '처리', width: 120, cell: actionBadge },
  ];
  return (
    <DataTable
      caption={caption}
      columns={columns}
      rows={items}
      rowKey={(i) => `${i.externalCode ?? ''}|${i.emdCode ?? ''}|${i.name}`}
      empty={<EmptyState compact title="보여 줄 단지가 없어요" />}
      card={(i) => (
        <>
          <div className={cardStyles.cardRow}>
            {nameCell(i)}
            {actionBadge(i)}
          </div>
          <div className={cardStyles.cardMeta}>
            <span>{i.emdName ?? '–'}</span>
            <span>{i.builtYear ? `${i.builtYear}년` : '준공 미상'}</span>
            <span>평형 {formatCount(i.areaTypeCount)}</span>
            <span>좌표 {i.hasLocation ? '있음' : '없음'}</span>
          </div>
        </>
      )}
    />
  );
}

/**
 * "실거래가로 단지 만들기": 미리보기 (dry run) → counts + sample → [단지 만들기] (confirm) →
 * progress → result with a link to the created 단지. Picks up the latest run after a reload.
 */
export function ComplexBootstrapCard({ canRun }: { canRun: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [months, setMonths] = useState('60');
  const [jobId, setJobId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const latest = useQuery({
    queryKey: qk('admin-complex-bootstrap', 'latest'),
    queryFn: ({ signal }) => complexes.latestBootstrap({ signal }),
    enabled: jobId === null,
  });
  const currentId = jobId ?? latest.data?.item?.jobId ?? null;
  const job = useQuery({
    queryKey: qk('admin-complex-bootstrap', 'job', currentId ?? ''),
    queryFn: ({ signal }) => complexes.bootstrapJob(currentId ?? '', { signal }),
    enabled: currentId !== null,
    refetchInterval: (q) => (isRunning(q.state.data) ? 1500 : false),
  });
  const view: BootstrapJob | null = job.data ?? (jobId ? null : (latest.data?.item ?? null));
  const running = isRunning(view);

  const start = useMutation({
    mutationFn: (dryRun: boolean) =>
      complexes.startBootstrap({
        months: !dryRun && view ? view.months : Number(months),
        dryRun,
      }),
    onSuccess: (accepted) => {
      setConfirm(false);
      setJobId(accepted.jobId);
      toast(accepted.dryRun ? '미리보기를 시작했어요.' : '단지 만들기를 시작했어요.');
    },
    onError: (e) => {
      setConfirm(false);
      toast({ message: errorMessage(e), tone: 'error' });
      if (e instanceof ApiError && e.status === 409)
        void queryClient.invalidateQueries({ queryKey: ['admin-complex-bootstrap'] });
    },
  });

  const preview = view?.status === 'completed' ? view.preview : null;
  const result = view?.status === 'completed' ? view.result : null;
  const period = view
    ? `${formatYearMonthInt(view.fromYm)} ~ ${formatYearMonthInt(view.toYm)}`
    : '';
  const canApply =
    canRun && !!preview && view?.dryRun === true && preview.toCreate + preview.toUpdate > 0;

  return (
    <Panel
      title="실거래가로 단지 만들기"
      description="국토교통부 실거래가에 나온 순천 아파트 단지를 자동으로 등록해요"
    >
      <div className={styles.bootBody}>
        {canRun ? (
          <div className={styles.triggerRow}>
            <div className={styles.monthField}>
              <Select
                label="가져올 기간"
                value={months}
                onChange={(e) => setMonths(e.target.value)}
                options={BOOTSTRAP_MONTH_OPTIONS}
                disabled={running || start.isPending}
              />
            </div>
            <Button
              variant="secondary"
              iconLeft={<Icon name="search" size={18} />}
              disabled={running || start.isPending}
              onClick={() => start.mutate(true)}
            >
              미리보기
            </Button>
            <p className={styles.triggerNote}>
              미리보기는 아무것도 저장하지 않아요. 같은 단지는 단지 코드로 다시 찾으므로 여러 번
              실행해도 중복되지 않고, 관리자가 입력한 정보는 덮어쓰지 않아요.
            </p>
          </div>
        ) : (
          <Callout size="sm" tone="muted" icon="lock">
            단지 만들기는 관리자 권한부터 실행할 수 있어요. 최근 실행 결과는 아래에서 볼 수 있어요.
          </Callout>
        )}

        {view && running && <ProgressBlock job={view} />}

        {(latest.isError || job.isError) && !view && (
          <Callout size="sm" tone="danger" title="작업 상태를 불러오지 못했어요">
            {errorMessage(latest.error ?? job.error)}
          </Callout>
        )}

        {view?.status === 'failed' && (
          <Callout size="sm" tone="danger" title="작업이 끝나지 못했어요">
            {/* The 일일 호출 한도 message already says when to run again. */}
            {view.failedReason?.includes('호출 한도')
              ? view.failedReason
              : `${view.failedReason ?? '알 수 없는 오류'} — 잠시 후 다시 실행하면 이미 불러온 달은 건너뛰고 이어서 진행해요.`}
          </Callout>
        )}

        {preview && view && (
          <>
            <p className={s.muted}>
              {view.dryRun ? '미리보기' : '실행 결과'} · {period} 계약분 · 실거래{' '}
              {formatCount(preview.rows)}건에서 단지 {formatCount(preview.candidates)}곳을 찾았어요
            </p>
            <div className={styles.kpis}>
              <StatTile
                label={view.dryRun ? '새로 만들 단지' : '새로 만든 단지'}
                value={formatCount(result?.created ?? preview.toCreate)}
                unit="곳"
                icon={<Icon name="plus" size={18} />}
                iconTone="brand"
              />
              <StatTile
                label={view.dryRun ? '빈 정보를 채울 단지' : '빈 정보를 채운 단지'}
                value={formatCount(result?.updated ?? preview.toUpdate)}
                unit="곳"
                detail={`이미 있는 단지 ${formatCount(preview.unchanged)}곳`}
                icon={<Icon name="check-circle" size={18} />}
              />
              <StatTile
                label="좌표 확인 필요"
                value={formatCount(preview.needsLocation)}
                unit="곳"
                detail="주소로 좌표를 찾지 못해 만들지 않아요"
                icon={<Icon name="alert" size={18} />}
                iconTone={preview.needsLocation > 0 ? 'accent' : 'neutral'}
              />
              <StatTile
                label="제외"
                value={formatCount(preview.skipped)}
                unit="곳"
                detail="법정동 불명 · 이름 겹침 · 삭제한 단지"
                icon={<Icon name="close" size={18} />}
              />
            </div>

            {result && (
              <Callout size="sm" tone="success" title="단지 만들기를 마쳤어요">
                단지 {formatCount(result.created)}곳을 만들고 {formatCount(result.updated)}곳의 빈
                정보를 채웠어요.
                {result.tradeSyncJobs > 0 &&
                  ` 같은 기간 실거래가 ${formatCount(result.tradeSyncJobs)}개월 동기화를 이어서 진행해요.`}{' '}
                <Link href={BOOTSTRAP_LIST_HREF} className={styles.syncLink}>
                  자동으로 만든 단지 보기
                  <Icon name="chevron-right" size={16} />
                </Link>
              </Callout>
            )}

            {view.dryRun ? (
              <ItemsTable items={preview.sample} caption="단지 만들기 미리보기" />
            ) : null}

            {preview.needsLocationItems.length > 0 && (
              <details className={styles.bootDetails}>
                <summary>
                  좌표를 찾지 못한 단지 {formatCount(preview.needsLocationItems.length)}곳 —{' '}
                  <Link href={`${ADMIN_ROUTES.complexes}/new`}>직접 등록</Link>
                </summary>
                <ItemsTable items={preview.needsLocationItems} caption="좌표 확인이 필요한 단지" />
              </details>
            )}

            {canApply && (
              <div className={styles.bootActions}>
                <Button
                  iconLeft={<Icon name="layers" size={18} />}
                  disabled={running || start.isPending}
                  onClick={() => setConfirm(true)}
                >
                  단지 만들기 ({formatCount(preview.toCreate)}곳)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => start.mutate(false)}
        title={`단지 ${formatCount(preview?.toCreate ?? 0)}곳을 만들까요?`}
        description={`${period} 실거래가로 새 단지를 만들고, 이미 있는 단지 ${formatCount(preview?.toUpdate ?? 0)}곳은 비어 있는 정보만 채워요. 끝나면 같은 기간 실거래가를 다시 동기화해 단지에 연결해요.`}
        confirmLabel="단지 만들기"
        loading={start.isPending}
      />
    </Panel>
  );
}
