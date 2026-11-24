'use client';
import { ADMIN_ROLES, AdminRole, ROLE_LABEL } from '@house/shared';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Icon,
  IconButton,
  ListSearchField,
  Panel,
  SegmentedControl,
  StatusPill,
  type BadgeProps,
  type TableColumn,
} from '@house/ui';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { qk } from '@/lib/api';
import { useAdminSession } from '@/lib/auth';
import { formatDateShort, formatRelativeTime } from '@/lib/format';
import { admins } from '../api';
import { useDevQuery } from '../api/dev';
import type { AdminAccount } from '../api/schemas';
import { DataTable, cardStyles } from '../components/DataTable';
import { LoadError } from '../components/LoadError';
import s from '../components/shared.module.css';
import { ADMIN_STATE_LABEL, ADMIN_STATE_TONE, adminAccountState } from '../lib/admins';
import { useUrlState } from '../lib/use-url-state';
import { AdminCreateDrawer, AdminEditDrawer } from './AdminDrawers';
import styles from './settings.module.css';

type RoleFilter = 'all' | AdminRole;
const ROLE_TONE: Record<AdminRole, NonNullable<BadgeProps['tone']>> = {
  SUPER_ADMIN: 'ink',
  ADMIN: 'brand',
  OPERATOR: 'neutral',
};
const ROLE_GUIDE: { role: AdminRole; text: string }[] = [
  {
    role: AdminRole.OPERATOR,
    text: '매물·중개사·회원 검수, 신고 처리, 내놓기·구하기, 공지·FAQ·동네TV, 단지 정보를 다뤄요.',
  },
  {
    role: AdminRole.ADMIN,
    text: '운영자 권한에 더해 배너·팝업, 사이트 설정, 약관, 실거래가 동기화, 작업 기록을 다뤄요.',
  },
  {
    role: AdminRole.SUPER_ADMIN,
    text: '모든 권한에 더해 관리자 계정을 만들고 권한을 바꿀 수 있어요. 2명 이상 두는 것을 권장해요.',
  },
];

/** 관리자 계정·권한 (SUPER_ADMIN only). */
export function AdminsView() {
  const { admin: me } = useAdminSession();
  const queryClient = useQueryClient();
  const dev = useDevQuery();
  const [url, setUrl] = useUrlState({ q: '', role: 'all' });
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const params = { q: url.q, role: url.role === 'all' ? undefined : url.role, ...dev };
  const list = useQuery({
    queryKey: qk('admin-admins', 'list', params),
    queryFn: ({ signal }) => admins.list(params, { signal }),
    placeholderData: keepPreviousData,
  });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-admins'] });
    void queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
  };
  const rows = list.data?.items ?? [];
  const editing = rows.find((a) => a.id === editingId) ?? null;
  const filtered = url.q !== '' || url.role !== 'all';

  const person = (a: AdminAccount) => (
    <div className={styles.person}>
      <Avatar name={a.name} size={36} tone={a.status === 'DISABLED' ? 'neutral' : 'ink'} />
      <div className={styles.personText}>
        <span className={styles.personName}>
          {a.name}
          {a.id === me?.id && <Badge tone="brand">나</Badge>}
        </span>
        <span className={styles.personSub}>{a.email}</span>
      </div>
    </div>
  );
  const statePill = (a: AdminAccount) => {
    const state = adminAccountState(a);
    return <StatusPill tone={ADMIN_STATE_TONE[state]}>{ADMIN_STATE_LABEL[state]}</StatusPill>;
  };
  const totp = (a: AdminAccount) =>
    a.totpEnabled ? <Badge tone="success">OTP 사용</Badge> : <Badge tone="warn">미등록</Badge>;
  const lastLogin = (a: AdminAccount) =>
    a.lastLoginAt ? (
      <div className={styles.actor}>
        <span>{formatRelativeTime(a.lastLoginAt)}</span>
        {a.lastLoginIp && <span className={`${s.muted} ${s.small} ${s.num}`}>{a.lastLoginIp}</span>}
      </div>
    ) : (
      <span className={s.muted}>로그인한 적 없음</span>
    );

  const columns: TableColumn<AdminAccount>[] = [
    { key: 'person', header: '이름 · 이메일', cell: person },
    {
      key: 'role',
      header: '권한',
      width: 120,
      cell: (a) => <Badge tone={ROLE_TONE[a.role]}>{ROLE_LABEL[a.role]}</Badge>,
    },
    { key: 'state', header: '상태', width: 130, cell: statePill },
    { key: 'totp', header: '2단계 인증', width: 110, cell: totp },
    { key: 'lastLogin', header: '최근 로그인', width: 150, cell: lastLogin },
    {
      key: 'createdAt',
      header: '생성일',
      width: 110,
      cell: (a) => <span className={s.num}>{formatDateShort(a.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: '관리',
      align: 'right',
      width: 64,
      cell: (a) => (
        <IconButton
          label={`${a.name} 계정 관리`}
          size={36}
          variant="plain"
          onClick={(e) => {
            e.stopPropagation();
            setEditingId(a.id);
          }}
        >
          <Icon name="edit" size={18} />
        </IconButton>
      ),
    },
  ];

  return (
    <>
      <div className={s.bar}>
        <div className={s.filters}>
          <SegmentedControl<RoleFilter>
            label="권한"
            size="sm"
            value={url.role as RoleFilter}
            onChange={(role) => setUrl({ role })}
            options={[
              { value: 'all', label: '전체' },
              ...[...ADMIN_ROLES].reverse().map((role) => ({
                value: role as AdminRole,
                label: ROLE_LABEL[role],
              })),
            ]}
          />
          <ListSearchField
            className={s.search}
            label="이름·이메일 검색"
            placeholder="이름, 이메일 검색"
            value={url.q}
            onSearch={(q) => setUrl({ q })}
          />
        </div>
        <div className={s.barEnd}>
          <Button iconLeft={<Icon name="plus" size={18} />} onClick={() => setCreating(true)}>
            관리자 추가
          </Button>
        </div>
      </div>

      <Panel
        title="관리자 계정"
        count={list.data?.total}
        description="모든 관리자는 비밀번호와 OTP(2단계 인증)로 로그인해요"
        flush
      >
        {list.isError ? (
          <LoadError error={list.error} onRetry={() => void list.refetch()} />
        ) : (
          <DataTable
            caption="관리자 계정 목록"
            columns={columns}
            rows={rows}
            rowKey={(a) => a.id}
            loading={list.isPending}
            loadingRows={5}
            onRowClick={(a) => setEditingId(a.id)}
            empty={
              filtered ? (
                <EmptyState
                  compact
                  title="조건에 맞는 계정이 없어요"
                  description="검색어나 권한을 바꿔 보세요."
                />
              ) : (
                <EmptyState
                  compact
                  icon="users"
                  title="관리자 계정이 없어요"
                  action={
                    <Button size="sm" onClick={() => setCreating(true)}>
                      관리자 추가
                    </Button>
                  }
                />
              )
            }
            card={(a) => (
              <>
                <div className={cardStyles.cardRow}>
                  {person(a)}
                  <IconButton
                    label={`${a.name} 계정 관리`}
                    size={36}
                    variant="plain"
                    onClick={() => setEditingId(a.id)}
                  >
                    <Icon name="edit" size={18} />
                  </IconButton>
                </div>
                <div className={cardStyles.cardMeta}>
                  <Badge tone={ROLE_TONE[a.role]}>{ROLE_LABEL[a.role]}</Badge>
                  {statePill(a)}
                  {totp(a)}
                  <span>
                    {a.lastLoginAt
                      ? `${formatRelativeTime(a.lastLoginAt)} 로그인`
                      : '로그인한 적 없음'}
                  </span>
                </div>
              </>
            )}
          />
        )}
      </Panel>

      <Panel title="권한 안내">
        <div className={styles.roleGuide}>
          {ROLE_GUIDE.map(({ role, text }) => (
            <div key={role} className={styles.roleCard}>
              <h3>
                <Badge tone={ROLE_TONE[role]}>{ROLE_LABEL[role]}</Badge>
              </h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </Panel>

      <AdminCreateDrawer
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          invalidate();
        }}
      />
      <AdminEditDrawer
        account={editing}
        isSelf={!!editing && editing.id === me?.id}
        onClose={() => setEditingId(null)}
        onChanged={(closed) => {
          if (closed) setEditingId(null);
          invalidate();
        }}
      />
    </>
  );
}
