'use client';
import { ASSET_TYPE_LABEL, DealRequestStatus, DealRequestType } from '@house/shared';
import {
  Badge,
  Button,
  Icon,
  ListSearchField,
  Panel,
  StatusPill,
  type TableColumn,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo } from 'react';
import { formatCount, formatDday, formatRelativeTime } from '@/lib/format';
import d from './deal-requests.module.css';
import { MOD_PAGE_SIZE, fetchCounts, fetchDealRequests, modKeys } from '../api/queries';
import type { AdminDealRequestListItem } from '../api/schemas';
import {
  DEAL_REQUEST_STATUS_META,
  dealRequestPrice,
  dealRequestSpamState,
  dealRequestTitle,
  dealRequestTypeLabel,
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

const TAB_VALUES = ['ALL', 'SELL', 'WANTED', 'SUSPECTED', 'FLAGGED'] as const;
type Tab = (typeof TAB_VALUES)[number];

const SPEC = {
  tab: { kind: 'enum', values: TAB_VALUES, fallback: 'ALL' },
  status: { kind: 'enum', values: Object.values(DealRequestStatus) },
  q: { kind: 'text' },
} as const satisfies ParamSpec;

const TAB_LABEL: Record<Tab, string> = {
  ALL: '전체',
  SELL: '내놓기',
  WANTED: '구하기',
  SUSPECTED: '스팸 의심',
  FLAGGED: '스팸 표시',
};
const TAB_QUERY: Record<Tab, Record<string, string>> = {
  ALL: {},
  SELL: { type: DealRequestType.SELL_OR_LEASE },
  WANTED: { type: DealRequestType.WANTED },
  SUSPECTED: { spam: 'suspected' },
  FLAGGED: { spam: 'flagged' },
};

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  ...Object.values(DealRequestStatus).map((v) => ({
    value: v,
    label: DEAL_REQUEST_STATUS_META[v].label,
  })),
];

export const dealRequestHref = (id: string) => `/deal-requests/${id}`;

export function TypeBadge({ type }: { type: DealRequestType }) {
  return (
    <Badge tone={type === DealRequestType.SELL_OR_LEASE ? 'brand' : 'accent'}>
      {dealRequestTypeLabel(type)}
    </Badge>
  );
}

export function SpamBadge({
  request,
}: {
  request: Pick<AdminDealRequestListItem, 'spamFlaggedAt' | 'spamSignalCount' | 'status'>;
}) {
  const state = dealRequestSpamState(request);
  if (state === 'clean') return null;
  return state === 'flagged' ? (
    <Badge tone="danger">스팸 표시</Badge>
  ) : (
    <Badge tone="warn">스팸 의심 · 신호 {request.spamSignalCount}건</Badge>
  );
}

function StatusCell({ request }: { request: AdminDealRequestListItem }) {
  const meta = DEAL_REQUEST_STATUS_META[request.status];
  return (
    <span className={s.tagRow}>
      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      <SpamBadge request={request} />
    </span>
  );
}

function ProgressCell({ request }: { request: AdminDealRequestListItem }) {
  return (
    <span className={s.cellStack}>
      <span>
        제안{' '}
        <strong className={`${s.num} ${s.cellStrong}`}>{formatCount(request.proposalCount)}</strong>
        건
      </span>
      <span className={s.mutedText} style={{ fontSize: 12 }}>
        대상 중개사 {formatCount(request.targetAgencyCount)}곳
      </span>
    </span>
  );
}

function CreatedCell({ request }: { request: AdminDealRequestListItem }) {
  return (
    <span className={s.cellStack}>
      <span>{formatRelativeTime(request.createdAt)}</span>
      {request.status === DealRequestStatus.OPEN && request.expiresAt && (
        <span className={s.mutedText} style={{ fontSize: 12 }}>
          만료 {formatDday(request.expiresAt)}
        </span>
      )}
    </span>
  );
}

/** 내놓기·구하기 모니터링 (`/deal-requests`): every request, newest first, spam suspects in tabs. */
export function DealRequestsListView() {
  const { values, set, reset, hrefFor } = useListParams(SPEC);
  const tab = values.tab as Tab;

  const query = useMemo(
    () => ({
      ...TAB_QUERY[tab],
      status: values.status || undefined,
      q: values.q || undefined,
      page: values.page,
      pageSize: MOD_PAGE_SIZE,
    }),
    [tab, values.status, values.q, values.page],
  );
  const list = useQuery({
    queryKey: modKeys.dealRequests(query),
    queryFn: ({ signal }) => fetchDealRequests(query, signal),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: modKeys.dealRequestCounts,
    queryFn: ({ signal }) => fetchCounts('/admin/deal-requests', TAB_QUERY, signal),
  });

  const columns = useMemo<TableColumn<AdminDealRequestListItem>[]>(
    () => [
      {
        key: 'request',
        header: '요청',
        cell: (row) => (
          <div className={s.cellMain}>
            <span
              className={`${s.cellIcon} ${row.type === DealRequestType.WANTED ? d.iconWanted : d.iconSell}`}
            >
              <Icon
                name={row.type === DealRequestType.WANTED ? 'home-search' : 'home-up'}
                size={18}
              />
            </span>
            <span className={s.cellText}>
              <span className={d.titleRow}>
                <TypeBadge type={row.type} />
                <RowLink href={dealRequestHref(row.id)}>{dealRequestTitle(row)}</RowLink>
              </span>
              <span className={s.cellSub}>
                {ASSET_TYPE_LABEL[row.assetType]} · {dealRequestPrice(row)}
              </span>
            </span>
          </div>
        ),
      },
      {
        key: 'requester',
        header: '요청자',
        cell: (row) => (
          <span className={s.cellStrong}>{row.requester?.nickname ?? '탈퇴한 회원'}</span>
        ),
      },
      { key: 'progress', header: '진행', cell: (row) => <ProgressCell request={row} /> },
      { key: 'created', header: '등록', cell: (row) => <CreatedCell request={row} /> },
      { key: 'status', header: '상태', cell: (row) => <StatusCell request={row} /> },
      {
        key: 'open',
        header: '관리',
        align: 'right',
        cell: (row) => (
          <RowActions>
            <Button
              size="sm"
              variant={dealRequestSpamState(row) === 'suspected' ? 'primary' : 'secondary'}
              href={dealRequestHref(row.id)}
              linkAs={Link}
            >
              {dealRequestSpamState(row) === 'suspected' ? '확인' : '상세'}
            </Button>
          </RowActions>
        ),
      },
    ],
    [],
  );

  const filtered = hasActiveFilters(values, SPEC, ['tab']);
  const spamTab = tab === 'SUSPECTED' || tab === 'FLAGGED';
  return (
    <div className={s.page}>
      <ListHead
        label="요청 구분"
        current={tab}
        tabs={TAB_VALUES.map((value) => ({
          value,
          label: TAB_LABEL[value],
          count: counts.data?.[value],
          href: hrefFor({ tab: value, page: 1 }),
        }))}
      >
        <ListSearchField
          className={s.search}
          label="요청 검색"
          placeholder="단지·지역, 요청자 닉네임, 내용 검색"
          value={values.q}
          onSearch={(q, mode) => set({ q }, { replace: mode === 'typing' })}
        />
      </ListHead>

      <Panel
        flush
        title={
          tab === 'SUSPECTED'
            ? '스팸이 의심되는 요청'
            : tab === 'FLAGGED'
              ? '스팸으로 표시한 요청'
              : `${tab === 'ALL' ? '내놓기·구하기' : TAB_LABEL[tab]} 요청`
        }
        count={list.data ? formatCount(list.data.total) : undefined}
        description={
          tab === 'SUSPECTED'
            ? '반복 등록 · 외부 연락 유도 · 시세 이탈을 자동으로 감지해요'
            : tab === 'FLAGGED'
              ? '표시한 요청은 중개사무소에 노출되지 않아요'
              : undefined
        }
        actions={
          <div className={s.filters}>
            {filtered && <ResetFiltersButton onClick={() => reset({ tab })} />}
            <FilterSelect
              field="상태"
              options={STATUS_OPTIONS}
              value={values.status}
              onChange={(status) => set({ status })}
            />
          </div>
        }
      >
        <ModList
          caption={`${TAB_LABEL[tab]} 요청 목록`}
          columns={columns}
          rowKey={(row) => row.id}
          rowHref={(row) => dealRequestHref(row.id)}
          data={list.data}
          isPending={list.isPending}
          isFetching={list.isPlaceholderData}
          error={list.error}
          onRetry={() => void list.refetch()}
          footerNote="최근 등록 순"
          hrefForPage={(page) => hrefFor({ page })}
          empty={
            filtered
              ? {
                  title: '조건에 맞는 요청이 없어요',
                  description: '검색어나 상태 필터를 바꿔 보세요.',
                  action: (
                    <Button size="sm" variant="secondary" onClick={() => reset({ tab })}>
                      필터 초기화
                    </Button>
                  ),
                }
              : spamTab
                ? {
                    icon: 'check-circle',
                    title:
                      tab === 'SUSPECTED'
                        ? '스팸이 의심되는 요청이 없어요'
                        : '스팸으로 표시한 요청이 없어요',
                    description: '자동 감지 신호가 생기면 스팸 의심 탭에 모여요.',
                  }
                : { icon: 'home-up', title: '등록된 요청이 없어요' }
          }
          renderCard={(row) => (
            <ModCard
              href={dealRequestHref(row.id)}
              title={dealRequestTitle(row)}
              badge={
                <StatusPill tone={DEAL_REQUEST_STATUS_META[row.status].tone}>
                  {DEAL_REQUEST_STATUS_META[row.status].label}
                </StatusPill>
              }
              meta={
                <>
                  <span>
                    {row.requester?.nickname ?? '탈퇴한 회원'} · {formatRelativeTime(row.createdAt)}
                  </span>
                  <span>
                    대상 {formatCount(row.targetAgencyCount)}곳 · 제안{' '}
                    {formatCount(row.proposalCount)}건
                  </span>
                </>
              }
            >
              <div className={s.tagRow}>
                <TypeBadge type={row.type} />
                <span className={d.cardPrice}>
                  {ASSET_TYPE_LABEL[row.assetType]} · {dealRequestPrice(row)}
                </span>
              </div>
              {dealRequestSpamState(row) !== 'clean' && (
                <div className={s.tagRow}>
                  <SpamBadge request={row} />
                </div>
              )}
            </ModCard>
          )}
        />
      </Panel>
    </div>
  );
}
