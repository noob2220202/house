'use client';
import { AUTH_PROVIDER_LABEL, AuthProvider, UserRole } from '@house/shared';
import {
  Avatar,
  Badge,
  Button,
  Callout,
  ListSearchField,
  Panel,
  StatusPill,
  type TableColumn,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo } from 'react';
import { formatCount, formatDateShort, formatRelativeTime } from '@/lib/format';
import { ProviderMarks } from './ProviderMarks';
import u from './users.module.css';
import { MOD_PAGE_SIZE, fetchCounts, fetchUsers, modKeys } from '../api/queries';
import type { AdminUserListItem } from '../api/schemas';
import {
  USER_ROLE_SHORT,
  USER_STATUS_META,
  maskEmail,
  maskName,
  maskPhoneOnce,
  isScrubbedMember,
  userDisplayName,
} from '../lib/labels';
import { hasActiveFilters, type ParamSpec } from '../lib/list-params';
import { useListParams } from '../lib/use-list-params';
import {
  FilterSelect,
  ListHead,
  ModCard,
  ModList,
  ResetFiltersButton,
  RowActions,
  RowLink,
} from '../ui/ModList';
import s from '../ui/ui.module.css';

const TAB_VALUES = ['ALL', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN'] as const;
type Tab = (typeof TAB_VALUES)[number];

const SPEC = {
  status: { kind: 'enum', values: TAB_VALUES, fallback: 'ALL' },
  role: { kind: 'enum', values: Object.values(UserRole) },
  provider: { kind: 'enum', values: Object.values(AuthProvider) },
  q: { kind: 'text' },
} as const satisfies ParamSpec;

const TAB_LABEL: Record<Tab, string> = {
  ALL: '전체',
  ACTIVE: USER_STATUS_META.ACTIVE.label,
  SUSPENDED: USER_STATUS_META.SUSPENDED.label,
  WITHDRAWN: USER_STATUS_META.WITHDRAWN.label,
};
const tabQuery = (tab: Tab) => (tab === 'ALL' ? {} : { status: tab });
const COUNT_QUERIES = Object.fromEntries(TAB_VALUES.map((t) => [t, tabQuery(t)])) as Record<
  Tab,
  Record<string, string>
>;

const ROLE_OPTIONS = [
  { value: '', label: '전체' },
  ...Object.values(UserRole).map((v) => ({ value: v, label: USER_ROLE_SHORT[v] })),
];
const PROVIDER_OPTIONS = [
  { value: '', label: '전체' },
  ...Object.values(AuthProvider).map((v) => ({
    value: v,
    label: AUTH_PROVIDER_LABEL[v],
  })),
];

export const userHref = (id: string) => `/users/${id}`;

/** A withdrawn member whose personal data was destroyed has no name / nickname left. */
const isAnonymous = (user: AdminUserListItem) => isScrubbedMember(user);

function MemberCell({ user }: { user: AdminUserListItem }) {
  const anonymous = isAnonymous(user);
  const name = anonymous ? '탈퇴한 회원' : userDisplayName(user);
  return (
    <div className={u.memberCell}>
      <Avatar name={anonymous ? '–' : name} size={36} tone={anonymous ? 'neutral' : 'soft'} />
      <span className={s.cellText}>
        <RowLink href={userHref(user.id)}>{name}</RowLink>
        <span className={s.cellSub}>
          {anonymous ? '개인정보 파기 완료' : maskName(user.name) || '이름 미입력'}
        </span>
      </span>
    </div>
  );
}

function ContactCell({ user }: { user: AdminUserListItem }) {
  if (!user.email && !user.phone) return <span className={s.mutedText}>–</span>;
  return (
    <span className={u.contact}>
      {user.email && <span>{maskEmail(user.email)}</span>}
      {user.phone && <span className={s.mono}>{maskPhoneOnce(user.phone)}</span>}
    </span>
  );
}

function RoleCell({ user }: { user: AdminUserListItem }) {
  return (
    <span className={s.cellStack}>
      <span>
        {user.role === UserRole.USER ? (
          USER_ROLE_SHORT.USER
        ) : (
          <Badge tone={user.role === UserRole.AGENCY_OWNER ? 'ink' : 'brand'}>
            {USER_ROLE_SHORT[user.role]}
          </Badge>
        )}
      </span>
      {user.agency && (
        <span className={s.mutedText} style={{ fontSize: 12 }}>
          {user.agency.name}
        </span>
      )}
    </span>
  );
}

/** 회원 관리 (`/users`): member search. Personal data is masked here; details are audit-logged. */
export function UsersListView() {
  const { values, set, reset, hrefFor } = useListParams(SPEC);
  const tab = values.status as Tab;

  const query = useMemo(
    () => ({
      ...tabQuery(tab),
      role: values.role || undefined,
      provider: values.provider || undefined,
      q: values.q || undefined,
      page: values.page,
      pageSize: MOD_PAGE_SIZE,
    }),
    [tab, values.role, values.provider, values.q, values.page],
  );
  const list = useQuery({
    queryKey: modKeys.users(query),
    queryFn: ({ signal }) => fetchUsers(query, signal),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: modKeys.userCounts,
    queryFn: ({ signal }) => fetchCounts('/admin/users', COUNT_QUERIES, signal),
  });

  const columns = useMemo<TableColumn<AdminUserListItem>[]>(
    () => [
      { key: 'member', header: '회원', cell: (row) => <MemberCell user={row} /> },
      { key: 'contact', header: '이메일 · 연락처', cell: (row) => <ContactCell user={row} /> },
      { key: 'role', header: '유형', cell: (row) => <RoleCell user={row} /> },
      {
        key: 'providers',
        header: '로그인 수단',
        cell: (row) => <ProviderMarks providers={row.providers} />,
      },
      {
        key: 'joined',
        header: '가입일',
        cell: (row) => <span className={s.num}>{formatDateShort(row.createdAt)}</span>,
      },
      {
        key: 'lastLogin',
        header: '최근 로그인',
        cell: (row) =>
          row.lastLoginAt ? (
            formatRelativeTime(row.lastLoginAt)
          ) : (
            <span className={s.mutedText}>–</span>
          ),
      },
      {
        key: 'status',
        header: '상태',
        cell: (row) => (
          <StatusPill tone={USER_STATUS_META[row.status].tone}>
            {USER_STATUS_META[row.status].label}
          </StatusPill>
        ),
      },
      {
        key: 'open',
        header: '관리',
        align: 'right',
        cell: (row) => (
          <RowActions>
            <Button size="sm" variant="secondary" href={userHref(row.id)} linkAs={Link}>
              상세
            </Button>
          </RowActions>
        ),
      },
    ],
    [],
  );

  const filtered = hasActiveFilters(values, SPEC, ['status']);
  return (
    <div className={s.page}>
      <ListHead
        label="회원 상태"
        current={tab}
        tabs={TAB_VALUES.map((value) => ({
          value,
          label: TAB_LABEL[value],
          count: counts.data?.[value],
          href: hrefFor({ status: value, page: 1 }),
        }))}
      >
        <ListSearchField
          className={s.search}
          label="회원 검색"
          placeholder="닉네임, 이름, 이메일, 연락처 검색"
          value={values.q}
          onSearch={(q, mode) => set({ q }, { replace: mode === 'typing' })}
        />
      </ListHead>

      <Callout size="sm" icon="shield">
        <strong>목록에서는 이름·이메일·연락처를 일부만 보여 줘요.</strong> 회원 상세를 열면 전체
        정보가 보이고, 열람한 관리자 계정과 시각이 작업 기록에 남아요.
      </Callout>

      <Panel
        flush
        title={tab === 'ALL' ? '회원' : `${TAB_LABEL[tab]} 회원`}
        count={list.data ? formatCount(list.data.total) : undefined}
        actions={
          <div className={s.filters}>
            {filtered && <ResetFiltersButton onClick={() => reset({ status: tab })} />}
            <FilterSelect
              field="유형"
              options={ROLE_OPTIONS}
              value={values.role}
              onChange={(role) => set({ role })}
            />
            <FilterSelect
              field="로그인 수단"
              options={PROVIDER_OPTIONS}
              value={values.provider}
              onChange={(provider) => set({ provider })}
            />
          </div>
        }
      >
        <ModList
          caption={`${TAB_LABEL[tab]} 회원 목록`}
          columns={columns}
          rowKey={(row) => row.id}
          rowHref={(row) => userHref(row.id)}
          data={list.data}
          isPending={list.isPending}
          isFetching={list.isPlaceholderData}
          error={list.error}
          onRetry={() => void list.refetch()}
          unit="명"
          footerNote="최근 가입 순"
          hrefForPage={(page) => hrefFor({ page })}
          empty={
            filtered
              ? {
                  title: values.q
                    ? `'${values.q}' 검색 결과가 없어요`
                    : '조건에 맞는 회원이 없어요',
                  description: '닉네임, 이름, 이메일, 연락처를 다시 확인하거나 필터를 바꿔 보세요.',
                  action: (
                    <Button size="sm" variant="secondary" onClick={() => reset({ status: tab })}>
                      필터 초기화
                    </Button>
                  ),
                }
              : { icon: 'users', title: `${TAB_LABEL[tab]} 상태의 회원이 없어요` }
          }
          renderCard={(row) => {
            const anonymous = isAnonymous(row);
            return (
              <ModCard
                href={userHref(row.id)}
                title={anonymous ? '탈퇴한 회원' : userDisplayName(row)}
                badge={
                  <StatusPill tone={USER_STATUS_META[row.status].tone}>
                    {USER_STATUS_META[row.status].label}
                  </StatusPill>
                }
                meta={
                  <>
                    <span>
                      {anonymous
                        ? '개인정보 파기 완료'
                        : [maskName(row.name), maskEmail(row.email)].filter(Boolean).join(' · ')}
                    </span>
                    <span>
                      가입 {formatDateShort(row.createdAt)}
                      {row.lastLoginAt && ` · 최근 로그인 ${formatRelativeTime(row.lastLoginAt)}`}
                    </span>
                  </>
                }
              >
                <div className={s.tagRow}>
                  {row.role === UserRole.USER ? (
                    <Badge>{USER_ROLE_SHORT.USER}</Badge>
                  ) : (
                    <Badge tone={row.role === UserRole.AGENCY_OWNER ? 'ink' : 'brand'}>
                      {USER_ROLE_SHORT[row.role]}
                    </Badge>
                  )}
                  {row.agency && <span className={s.cellSub}>{row.agency.name}</span>}
                  <ProviderMarks providers={row.providers} size="sm" />
                </div>
              </ModCard>
            );
          }}
        />
      </Panel>
    </div>
  );
}
