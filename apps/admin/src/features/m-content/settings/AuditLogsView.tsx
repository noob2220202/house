'use client';
import { AdminRole } from '@house/shared';
import {
  Badge,
  Checkbox,
  Drawer,
  EmptyState,
  Icon,
  IconButton,
  Input,
  Panel,
  SegmentedControl,
  Select,
  cx,
  type TableColumn,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { qk } from '@/lib/api';
import { useAdminSession } from '@/lib/auth';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { admins, auditLogs } from '../api';
import { useDevQuery } from '../api/dev';
import type { AuditLog } from '../api/schemas';
import { DataTable, ListFooter, cardStyles } from '../components/DataTable';
import { LoadError } from '../components/LoadError';
import s from '../components/shared.module.css';
import { auditRange, rangePresetOf, type RangePreset } from '../lib/audit';
import { diffJson, formatDiffValue, summarizeDiff, type DiffRow } from '../lib/diff';
import {
  AUDIT_RESOURCE_LABEL,
  auditActionLabel,
  auditActionTone,
  auditResourceLabel,
  fieldLabel,
} from '../lib/labels';
import { kstDateAfter } from '../lib/terms';
import { useUrlState } from '../lib/use-url-state';
import { describeUserAgent } from '../lib/user-agent';
import styles from './settings.module.css';

const PAGE_SIZE = 20;
const KIND_LABEL = { added: '추가', removed: '삭제', changed: '변경', unchanged: '' } as const;
const KIND_CLASS = {
  added: styles.kindAdded,
  removed: styles.kindRemoved,
  changed: styles.kindChanged,
  unchanged: undefined,
} as const;
const ROW_CLASS = {
  added: styles.rowAdded,
  removed: styles.rowRemoved,
  changed: styles.rowChanged,
  unchanged: undefined,
} as const;

/** A USER row is a member's own action; an ADMIN row without a name is a deleted account. */
const actorName = (log: AuditLog) =>
  log.actorType === 'SYSTEM'
    ? '시스템 (자동 실행)'
    : log.actorType === 'USER'
      ? '회원'
      : (log.adminName ?? log.adminEmail ?? '삭제된 관리자 계정');

/** A missing value reads "없음" in muted text (never struck through). */
function DiffValue({ value }: { value: unknown }) {
  const text = formatDiffValue(value);
  return value === null || value === undefined || value === '' ? (
    <span className={styles.nil}>{text}</span>
  ) : (
    text
  );
}

function DiffTable({ rows }: { rows: DiffRow[] }) {
  return (
    <table className={styles.diff}>
      <caption className="sr-only">변경 전과 변경 후 비교</caption>
      <thead>
        <tr>
          <th scope="col">항목</th>
          <th scope="col">변경 전</th>
          <th scope="col">변경 후</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.path} className={ROW_CLASS[row.kind]}>
            <th scope="row">
              {fieldLabel(row.path)}
              {row.kind !== 'unchanged' && (
                <span className={cx(styles.diffKind, KIND_CLASS[row.kind])}>
                  {KIND_LABEL[row.kind]}
                </span>
              )}
            </th>
            <td className={styles.before}>
              {row.kind === 'added' ? (
                <span className={styles.nil}>–</span>
              ) : (
                <DiffValue value={row.before} />
              )}
            </td>
            <td className={styles.after}>
              {row.kind === 'removed' ? (
                <span className={styles.nil}>–</span>
              ) : (
                <DiffValue value={row.after} />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LogDetail({ log }: { log: AuditLog }) {
  const [all, setAll] = useState(false);
  const rows = useMemo(
    () => diffJson(log.before, log.after, { includeUnchanged: all }),
    [log, all],
  );
  const hasSnapshot = log.before !== null || log.after !== null;
  return (
    <div className={s.stackLg}>
      <div className={styles.drawerHd}>
        <span>
          <Badge tone={auditActionTone(log.action)}>{auditActionLabel(log.action)}</Badge>
        </span>
        <p className={styles.drawerTitle}>
          {log.resourceLabel ?? auditResourceLabel(log.resourceType)}
        </p>
      </div>
      <dl className={s.facts}>
        <dt>일시</dt>
        <dd>
          {formatDateTime(log.createdAt)}{' '}
          <span className={s.muted}>({formatRelativeTime(log.createdAt)})</span>
        </dd>
        <dt>작업자</dt>
        <dd>
          {actorName(log)}
          {log.adminEmail && <span className={s.muted}> · {log.adminEmail}</span>}
        </dd>
        <dt>대상</dt>
        <dd>
          {auditResourceLabel(log.resourceType)}
          {log.resourceId && <span className={`${s.muted} ${s.small}`}> · {log.resourceId}</span>}
        </dd>
        <dt>접속 IP</dt>
        <dd>{log.ip ?? '기록 없음'}</dd>
        <dt>브라우저</dt>
        <dd title={log.userAgent ?? undefined}>{describeUserAgent(log.userAgent)}</dd>
        <dt>요청 ID</dt>
        <dd>{log.requestId ?? '기록 없음'}</dd>
        <dt>기록 코드</dt>
        <dd>{log.action}</dd>
      </dl>

      <section className={s.stack} aria-labelledby="audit-diff-title">
        <div className={styles.diffHd}>
          <h3 id="audit-diff-title" className={styles.sectionTitle}>
            변경 내용
          </h3>
          {hasSnapshot && log.before !== null && log.after !== null && (
            <Checkbox checked={all} onChange={(e) => setAll(e.target.checked)}>
              바뀌지 않은 항목도 보기
            </Checkbox>
          )}
        </div>
        {!hasSnapshot ? (
          <p className={styles.diffEmpty}>
            변경 전·후 값이 남지 않는 작업이에요. 개인정보 열람이나 비밀번호 재설정처럼 값을 남기면
            안 되는 작업은 누가 언제 했는지만 기록해요.
          </p>
        ) : rows.length === 0 ? (
          <p className={styles.diffEmpty}>바뀐 항목이 없어요.</p>
        ) : (
          <DiffTable rows={rows} />
        )}
      </section>
    </div>
  );
}

/** 작업 기록: audit-log viewer with resource / admin / period filters and a before–after diff. */
export function AuditLogsView() {
  const { can } = useAdminSession();
  const dev = useDevQuery();
  const [url, setUrl] = useUrlState({
    resourceType: '',
    adminUserId: '',
    from: '',
    to: '',
    page: '1',
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const range = auditRange(url.from, url.to);
  const params = {
    resourceType: url.resourceType || undefined,
    adminUserId: url.adminUserId || undefined,
    from: range.from,
    to: range.to,
    page: Number(url.page) || 1,
    pageSize: PAGE_SIZE,
    ...dev,
  };
  const list = useQuery({
    queryKey: qk('admin-audit-logs', 'list', params),
    queryFn: ({ signal }) => auditLogs.list(params, { signal }),
    placeholderData: keepPreviousData,
  });
  // The admin filter needs names: SUPER_ADMIN may list accounts; others pick from actors seen so far.
  const canListAdmins = can(AdminRole.SUPER_ADMIN);
  const accounts = useQuery({
    queryKey: qk('admin-admins', 'list', { for: 'audit' }),
    queryFn: ({ signal }) => admins.list({}, { signal }),
    enabled: canListAdmins,
    staleTime: 5 * 60_000,
  });
  const recent = useQuery({
    queryKey: qk('admin-audit-logs', 'actors'),
    queryFn: ({ signal }) => auditLogs.list({ pageSize: 100 }, { signal }),
    enabled: !canListAdmins,
    staleTime: 5 * 60_000,
  });
  const adminOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of accounts.data?.items ?? []) seen.set(a.id, a.name);
    for (const log of recent.data?.items ?? [])
      if (log.adminUserId && log.adminName) seen.set(log.adminUserId, log.adminName);
    return [...seen].map(([value, label]) => ({ value, label }));
  }, [accounts.data, recent.data]);

  const data = list.data;
  const rows = data?.items ?? [];
  const open = rows.find((r) => r.id === openId) ?? null;
  const filtered = !!(url.resourceType || url.adminUserId || url.from || url.to);
  const today = kstDateAfter(0);
  const preset = rangePresetOf(url.from, url.to, today);

  const actionBadge = (log: AuditLog) => (
    <Badge tone={auditActionTone(log.action)}>{auditActionLabel(log.action)}</Badge>
  );
  const target = (log: AuditLog) => (
    <span className={styles.target}>
      <span className={styles.targetType}>{auditResourceLabel(log.resourceType)}</span>
      {log.resourceLabel && <span className={styles.targetLabel}>{log.resourceLabel}</span>}
    </span>
  );
  const summary = (log: AuditLog) =>
    log.before === null && log.after === null ? (
      <span className={s.muted}>값 기록 없음</span>
    ) : (
      <span className={s.muted}>{summarizeDiff(diffJson(log.before, log.after))}</span>
    );

  const columns: TableColumn<AuditLog>[] = [
    {
      key: 'createdAt',
      header: '일시',
      width: 156,
      cell: (log) => <span className={s.num}>{formatDateTime(log.createdAt)}</span>,
    },
    {
      key: 'actor',
      header: '작업자',
      width: 150,
      cell: (log) => (
        <div className={styles.actor}>
          <span className={styles.actorName}>{actorName(log)}</span>
          {log.ip && <span className={`${s.muted} ${s.small} ${s.num}`}>{log.ip}</span>}
        </div>
      ),
    },
    { key: 'action', header: '작업', width: 170, cell: actionBadge },
    { key: 'target', header: '대상', cell: target },
    { key: 'summary', header: '변경', width: 170, cell: summary },
    {
      key: 'open',
      header: <span className="sr-only">자세히</span>,
      align: 'right',
      width: 56,
      // A real button so the detail drawer is reachable by keyboard (the row click is a shortcut).
      cell: (log) => (
        <IconButton
          label={`${auditActionLabel(log.action)} 자세히 보기`}
          size={36}
          variant="plain"
          onClick={(e) => {
            e.stopPropagation();
            setOpenId(log.id);
          }}
        >
          <Icon name="chevron-right" size={18} />
        </IconButton>
      ),
    },
  ];

  return (
    <>
      <div className={s.bar}>
        <div className={s.filters}>
          <SegmentedControl<RangePreset>
            label="기간"
            size="sm"
            value={preset}
            onChange={(next) => {
              if (next === 'custom') return;
              setUrl(
                next === 'all'
                  ? { from: '', to: '' }
                  : {
                      from: kstDateAfter(next === 'today' ? 0 : next === '7d' ? -6 : -29),
                      to: today,
                    },
              );
            }}
            options={[
              { value: 'all', label: '전체' },
              { value: 'today', label: '오늘' },
              { value: '7d', label: '7일' },
              { value: '30d', label: '30일' },
              { value: 'custom', label: '직접 선택', disabled: preset !== 'custom' },
            ]}
          />
          <div className={styles.dateRange}>
            <Input
              type="date"
              aria-label="시작일"
              value={url.from}
              max={url.to || today}
              onChange={(e) => setUrl({ from: e.target.value })}
            />
            <span className={s.muted} aria-hidden="true">
              ~
            </span>
            <Input
              type="date"
              aria-label="종료일"
              value={url.to}
              min={url.from || undefined}
              max={today}
              onChange={(e) => setUrl({ to: e.target.value })}
            />
          </div>
        </div>
      </div>

      <Panel
        title="작업 기록"
        count={data?.total}
        description="관리자가 바꾼 내용이 모두 남아요 · 수정·삭제할 수 없어요"
        flush
        actions={
          <div className={s.filters}>
            <div className={s.selectSm}>
              <Select
                aria-label="대상 종류"
                value={url.resourceType}
                onChange={(e) => setUrl({ resourceType: e.target.value })}
                options={[
                  { value: '', label: '대상 전체' },
                  ...Object.entries(AUDIT_RESOURCE_LABEL).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
              />
            </div>
            <div className={s.selectSm}>
              <Select
                aria-label="작업자"
                value={url.adminUserId}
                onChange={(e) => setUrl({ adminUserId: e.target.value })}
                options={[{ value: '', label: '작업자 전체' }, ...adminOptions]}
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
              unit="건"
              note="최신순"
            />
          ) : undefined
        }
      >
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            caption="작업 기록 목록"
            columns={columns}
            rows={rows}
            rowKey={(log) => log.id}
            loading={list.isPending}
            loadingRows={8}
            onRowClick={(log) => setOpenId(log.id)}
            empty={
              filtered ? (
                <EmptyState
                  compact
                  title="조건에 맞는 기록이 없어요"
                  description="기간이나 대상을 바꿔 보세요."
                />
              ) : (
                <EmptyState
                  compact
                  icon="clock"
                  title="아직 작업 기록이 없어요"
                  description="관리자가 내용을 바꾸면 여기에 남아요."
                />
              )
            }
            card={(log) => (
              <button type="button" className={styles.logCard} onClick={() => setOpenId(log.id)}>
                <span className={cardStyles.cardRow}>
                  {actionBadge(log)}
                  <span className={`${s.muted} ${s.small}`}>
                    {formatRelativeTime(log.createdAt)}
                  </span>
                </span>
                {target(log)}
                <span className={cardStyles.cardMeta}>
                  <span>{actorName(log)}</span>
                  {summary(log)}
                </span>
              </button>
            )}
          />
        )}
      </Panel>

      <Drawer
        open={open !== null}
        onClose={() => setOpenId(null)}
        title="작업 기록 상세"
        width={600}
      >
        {open && <LogDetail key={open.id} log={open} />}
      </Drawer>
    </>
  );
}
