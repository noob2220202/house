'use client';
import { AgencySiteDecisionAction, AgencySiteStatus } from '@house/shared';
import { Badge, Button, ListSearchField, Panel, StatusPill, type TableColumn } from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { env } from '@/config/env';
import { ADMIN_ROUTES } from '@/config/nav';
import { formatCount, formatDateShort } from '@/lib/format';
import { MOD_PAGE_SIZE, fetchAgencySites, fetchCounts, modKeys } from '../api/queries';
import type { AdminAgencySiteListItem } from '../api/schemas';
import {
  AGENCY_SITE_STATUS_META,
  siteHost,
  siteSlugOf,
  siteVisibility,
  waitingDays,
  waitingLabel,
} from '../lib/labels';
import type { ParamSpec } from '../lib/list-params';
import { useListParams } from '../lib/use-list-params';
import { ListHead, ModCard, ModList, RowActions, RowLink } from '../ui/ModList';
import s from '../ui/ui.module.css';
import { ColorSwatch } from './AgencySitePanel';
import { SiteDecisionDialog, type SiteIntent } from './SiteDecision';
import st from './site.module.css';

const TAB_VALUES = [
  AgencySiteStatus.REQUESTED,
  AgencySiteStatus.ACTIVE,
  AgencySiteStatus.SUSPENDED,
  AgencySiteStatus.REJECTED,
] as const;
type Tab = (typeof TAB_VALUES)[number];

const SPEC = {
  status: { kind: 'enum', values: TAB_VALUES, fallback: AgencySiteStatus.REQUESTED },
  q: { kind: 'text' },
} as const satisfies ParamSpec;

const TAB_LABEL: Record<Tab, string> = {
  REQUESTED: '승인 대기',
  ACTIVE: AGENCY_SITE_STATUS_META.ACTIVE.label,
  SUSPENDED: AGENCY_SITE_STATUS_META.SUSPENDED.label,
  REJECTED: AGENCY_SITE_STATUS_META.REJECTED.label,
};

const COUNT_QUERIES = {
  REQUESTED: { status: 'REQUESTED' },
  ACTIVE: { status: 'ACTIVE' },
  SUSPENDED: { status: 'SUSPENDED' },
  REJECTED: { status: 'REJECTED' },
} as const;

/** The office's detail page, scrolled to its 사무소 홈페이지 panel. */
export const siteHref = (row: AdminAgencySiteListItem) =>
  `${ADMIN_ROUTES.agencies}/${encodeURIComponent(row.agency.id)}#site`;

function AddressCell({ row }: { row: AdminAgencySiteListItem }) {
  const slug = siteSlugOf(row.site);
  if (!slug) return <span className={s.mutedText}>–</span>;
  const host = siteHost(slug, env.siteRootDomain);
  return (
    <span className={s.cellStack}>
      {row.site.url ? (
        <a
          className={st.host}
          href={row.site.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {host}
          <span className="sr-only">(새 창)</span>
        </a>
      ) : (
        <span className={st.host}>{host}</span>
      )}
      <span className={s.cellSub}>
        <ColorSwatch color={row.site.color} />
      </span>
    </span>
  );
}

function StatusCell({ row }: { row: AdminAgencySiteListItem }) {
  const meta = AGENCY_SITE_STATUS_META[row.site.status];
  const visibility = siteVisibility(row.site, row.agency.status);
  return (
    <span className={s.tagRow}>
      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      {visibility && <Badge tone={visibility.tone}>{visibility.label}</Badge>}
    </span>
  );
}

function DateCell({ row }: { row: AdminAgencySiteListItem }) {
  if (row.site.status !== AgencySiteStatus.REQUESTED)
    return (
      <span className={s.num}>{formatDateShort(row.site.decidedAt ?? row.site.requestedAt)}</span>
    );
  const days = waitingDays(row.site.requestedAt);
  return (
    <span className={s.cellStack}>
      <span className={s.num}>{formatDateShort(row.site.requestedAt)}</span>
      <span className={days >= 3 ? s.warnText : s.mutedText} style={{ fontSize: 12 }}>
        {waitingLabel(days)}
      </span>
    </span>
  );
}

/** 사무소 홈페이지 신청 queue + every office site by state (`/agencies/sites`). */
export function AgencySitesListView() {
  const { values, set, reset, hrefFor } = useListParams(SPEC);
  const tab = values.status as Tab;
  const [intent, setIntent] = useState<SiteIntent | null>(null);
  const decide = (row: AdminAgencySiteListItem, action: AgencySiteDecisionAction) =>
    setIntent({
      action,
      site: row.site,
      agencyName: row.agency.name,
      representativeName: row.agency.representativeName,
    });

  const query = useMemo(
    () => ({ status: tab, q: values.q || undefined, page: values.page, pageSize: MOD_PAGE_SIZE }),
    [tab, values.q, values.page],
  );
  const list = useQuery({
    queryKey: modKeys.agencySites(query),
    queryFn: ({ signal }) => fetchAgencySites(query, signal),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: modKeys.agencySiteCounts,
    queryFn: ({ signal }) => fetchCounts('/admin/agency-sites', COUNT_QUERIES, signal),
  });

  const columns = useMemo<TableColumn<AdminAgencySiteListItem>[]>(
    () => [
      {
        key: 'office',
        header: '중개사무소',
        cell: (row) => (
          <span className={s.cellStack}>
            <RowLink href={siteHref(row)}>{row.agency.name}</RowLink>
            <span className={s.cellSub}>대표 {row.agency.representativeName}</span>
          </span>
        ),
      },
      {
        key: 'address',
        header: tab === AgencySiteStatus.REQUESTED ? '신청 주소 · 색상' : '주소 · 색상',
        cell: (row) => <AddressCell row={row} />,
      },
      {
        key: 'tagline',
        header: '한 줄 소개',
        cell: (row) =>
          row.site.tagline ? (
            <span className={s.cellSub}>{row.site.tagline}</span>
          ) : (
            <span className={s.mutedText}>–</span>
          ),
      },
      { key: 'status', header: '상태', cell: (row) => <StatusCell row={row} /> },
      {
        key: 'date',
        header: tab === AgencySiteStatus.REQUESTED ? '신청일' : '처리일',
        cell: (row) => <DateCell row={row} />,
      },
      {
        key: 'actions',
        header: '관리',
        align: 'right',
        cell: (row) =>
          row.site.status === AgencySiteStatus.REQUESTED ? (
            <RowActions>
              <Button
                size="sm"
                variant="danger"
                aria-label={`${row.agency.name} 홈페이지 반려`}
                onClick={() => decide(row, AgencySiteDecisionAction.REJECT)}
              >
                반려
              </Button>
              <Button
                size="sm"
                aria-label={`${row.agency.name} 홈페이지 승인`}
                onClick={() => decide(row, AgencySiteDecisionAction.APPROVE)}
              >
                승인
              </Button>
            </RowActions>
          ) : (
            <RowActions>
              <Button size="sm" variant="secondary" href={siteHref(row)} linkAs={Link}>
                상세
              </Button>
            </RowActions>
          ),
      },
    ],
    [tab],
  );

  const total = list.data?.total;
  return (
    <div className={s.page}>
      <ListHead
        label="홈페이지 상태"
        current={tab}
        tabs={TAB_VALUES.map((value) => ({
          value,
          label: TAB_LABEL[value],
          count: counts.data?.[value],
          href: hrefFor({ status: value, q: values.q, page: 1 }),
        }))}
      >
        <ListSearchField
          className={s.search}
          label="홈페이지 검색"
          placeholder="상호, 대표자, 주소 검색"
          value={values.q}
          onSearch={(q, mode) => set({ q }, { replace: mode === 'typing' })}
        />
      </ListHead>

      <Panel
        flush
        title={
          tab === AgencySiteStatus.REQUESTED ? '승인 대기 홈페이지' : `${TAB_LABEL[tab]} 홈페이지`
        }
        count={total !== undefined ? formatCount(total) : undefined}
        description={
          tab === AgencySiteStatus.REQUESTED
            ? `주소는 신청한 이름.${env.siteRootDomain} 형태로 열려요 (예: sindae.${env.siteRootDomain}) · 오래된 신청부터`
            : undefined
        }
      >
        <ModList
          caption={`${TAB_LABEL[tab]} 사무소 홈페이지 목록`}
          columns={columns}
          rowKey={(row) => row.site.id}
          rowHref={siteHref}
          data={list.data}
          isPending={list.isPending}
          isFetching={list.isPlaceholderData}
          error={list.error}
          onRetry={() => void list.refetch()}
          unit="곳"
          footerNote={tab === AgencySiteStatus.REQUESTED ? '신청일 오래된 순' : '최근 처리 순'}
          hrefForPage={(page) => hrefFor({ page })}
          empty={
            values.q
              ? {
                  title: `'${values.q}' 검색 결과가 없어요`,
                  description: '상호, 대표자 이름, 홈페이지 주소를 다시 확인해 주세요.',
                  action: (
                    <Button size="sm" variant="secondary" onClick={() => reset({ status: tab })}>
                      검색 지우기
                    </Button>
                  ),
                }
              : tab === AgencySiteStatus.REQUESTED
                ? {
                    icon: 'check-circle',
                    title: '승인을 기다리는 홈페이지가 없어요',
                    description: '중개사무소가 주소를 신청하면 이곳에 오래된 순서로 쌓여요.',
                  }
                : { icon: 'link', title: `${TAB_LABEL[tab]} 상태의 홈페이지가 없어요` }
          }
          renderCard={(row) => (
            <ModCard
              href={siteHref(row)}
              title={row.agency.name}
              badge={<StatusCell row={row} />}
              meta={
                <>
                  <span>
                    {siteSlugOf(row.site)
                      ? siteHost(siteSlugOf(row.site) ?? '', env.siteRootDomain)
                      : '주소 없음'}
                  </span>
                  <span>
                    대표 {row.agency.representativeName} · 신청{' '}
                    {formatDateShort(row.site.requestedAt)}
                    {row.site.status === AgencySiteStatus.REQUESTED &&
                      ` · ${waitingLabel(waitingDays(row.site.requestedAt))}`}
                  </span>
                </>
              }
              actions={
                row.site.status === AgencySiteStatus.REQUESTED ? (
                  <>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => decide(row, AgencySiteDecisionAction.REJECT)}
                    >
                      반려
                    </Button>
                    <Button size="sm" onClick={() => decide(row, AgencySiteDecisionAction.APPROVE)}>
                      승인
                    </Button>
                  </>
                ) : undefined
              }
            >
              {row.site.tagline && <p className={s.cellSub}>{row.site.tagline}</p>}
            </ModCard>
          )}
        />
      </Panel>

      <SiteDecisionDialog intent={intent} onClose={() => setIntent(null)} />
    </div>
  );
}
