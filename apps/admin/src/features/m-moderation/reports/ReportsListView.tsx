'use client';
import { REPORT_REASON_LABEL, ReportStatus, ReportTargetType } from '@house/shared';
import {
  Badge,
  Button,
  DealBadge,
  Icon,
  ListSearchField,
  Panel,
  PhotoPlaceholder,
  StatusPill,
  dealKindOf,
  photoKindForAsset,
  type TableColumn,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo } from 'react';
import { formatCount, formatDateShort, formatRelativeTime } from '@/lib/format';
import r from './reports.module.css';
import { MOD_PAGE_SIZE, fetchCounts, fetchReports, modKeys } from '../api/queries';
import type { AdminReportListItem } from '../api/schemas';
import {
  REPORT_ACTION_LABEL,
  REPORT_SLA_HOURS,
  REPORT_STATUS_META,
  listingPrice,
  listingSpec,
  reportSlaLabel,
  reportTargetTitle,
} from '../lib/labels';
import { hasActiveFilters, type ParamSpec } from '../lib/list-params';
import { useListParams } from '../lib/use-list-params';
import { MediaImage } from '../ui/MediaImage';
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

const TAB_VALUES = ['RECEIVED', 'IN_REVIEW', 'RESOLVED', 'REJECTED', 'ALL'] as const;
type Tab = (typeof TAB_VALUES)[number];

const SPEC = {
  status: { kind: 'enum', values: TAB_VALUES, fallback: 'RECEIVED' },
  targetType: { kind: 'enum', values: Object.values(ReportTargetType) },
  q: { kind: 'text' },
} as const satisfies ParamSpec;

const TAB_LABEL: Record<Tab, string> = {
  RECEIVED: '새 신고',
  IN_REVIEW: REPORT_STATUS_META.IN_REVIEW.label,
  RESOLVED: REPORT_STATUS_META.RESOLVED.label,
  REJECTED: REPORT_STATUS_META.REJECTED.label,
  ALL: '전체',
};
const tabQuery = (tab: Tab) => (tab === 'ALL' ? {} : { status: tab });
const COUNT_QUERIES = Object.fromEntries(TAB_VALUES.map((t) => [t, tabQuery(t)])) as Record<
  Tab,
  Record<string, string>
>;

const TARGET_OPTIONS = [
  { value: '', label: '전체' },
  { value: ReportTargetType.LISTING, label: '매물' },
  { value: ReportTargetType.AGENCY, label: '중개사무소' },
];

export const reportHref = (id: string) => `/reports/${id}`;

const isOpen = (status: ReportStatus) =>
  status === ReportStatus.RECEIVED || status === ReportStatus.IN_REVIEW;

function TargetThumb({ report }: { report: AdminReportListItem }) {
  if (report.targetType === ReportTargetType.AGENCY || !report.listing) {
    return (
      <span className={s.cellIcon}>
        <Icon name="store" size={18} />
      </span>
    );
  }
  return (
    <span className={s.thumb}>
      {report.listing.coverUrl ? (
        <MediaImage src={report.listing.coverUrl} alt="" sizes="64px" />
      ) : (
        <PhotoPlaceholder kind={photoKindForAsset(report.listing.assetType ?? 'APT')} />
      )}
    </span>
  );
}

/** "매매 3억 1,000 · 32평 · 전용 84.9㎡" for a listing target, "중개사무소 신고" for an office. */
function TargetSub({ report }: { report: AdminReportListItem }) {
  const listing = report.listing;
  if (report.targetType === ReportTargetType.AGENCY || !listing)
    return <span className={s.cellSub}>중개사무소 신고</span>;
  return (
    <span className={r.targetSub}>
      <DealBadge deal={dealKindOf(listing.dealType)} />
      <strong className={s.num}>{listingPrice(listing)}</strong>
      <span className={s.cellSub}>{listingSpec(listing)}</span>
    </span>
  );
}

function ReasonCell({ report }: { report: AdminReportListItem }) {
  return (
    <span className={r.reasonCell}>
      <span className={s.tagRow}>
        <Badge tone="danger">{REPORT_REASON_LABEL[report.reason]}</Badge>
        {report.sameTargetCount > 1 && <Badge>같은 대상 {report.sameTargetCount}건</Badge>}
      </span>
      {report.detail && <span className={r.excerpt}>{report.detail}</span>}
    </span>
  );
}

function ReceivedCell({ report }: { report: AdminReportListItem }) {
  const sla = reportSlaLabel(report.createdAt, report.status);
  return (
    <span className={s.cellStack}>
      <span>{formatRelativeTime(report.createdAt)}</span>
      {sla ? (
        <span className={sla.overdue ? s.dangerText : s.mutedText} style={{ fontSize: 12 }}>
          {sla.text}
        </span>
      ) : (
        report.handledAt && (
          <span className={s.mutedText} style={{ fontSize: 12 }}>
            {formatDateShort(report.handledAt)} 처리
          </span>
        )
      )}
    </span>
  );
}

function StatusCell({ report }: { report: AdminReportListItem }) {
  const meta = REPORT_STATUS_META[report.status];
  return (
    <span className={s.cellStack}>
      <span>
        <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      </span>
      {report.status === ReportStatus.RESOLVED && report.action && report.action !== 'NONE' && (
        <span className={s.mutedText} style={{ fontSize: 12 }}>
          {REPORT_ACTION_LABEL[report.action]}
        </span>
      )}
    </span>
  );
}

/** 허위매물 신고 queue (`/reports`): new reports oldest first, handled ones newest first. */
export function ReportsListView() {
  const { values, set, reset, hrefFor } = useListParams(SPEC);
  const tab = values.status as Tab;

  const query = useMemo(
    () => ({
      ...tabQuery(tab),
      targetType: values.targetType || undefined,
      q: values.q || undefined,
      page: values.page,
      pageSize: MOD_PAGE_SIZE,
    }),
    [tab, values.targetType, values.q, values.page],
  );
  const list = useQuery({
    queryKey: modKeys.reports(query),
    queryFn: ({ signal }) => fetchReports(query, signal),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: modKeys.reportCounts,
    queryFn: ({ signal }) => fetchCounts('/admin/reports', COUNT_QUERIES, signal),
  });

  const columns = useMemo<TableColumn<AdminReportListItem>[]>(
    () => [
      {
        key: 'target',
        header: '신고 대상',
        cell: (row) => (
          <div className={s.cellMain}>
            <TargetThumb report={row} />
            <span className={s.cellText}>
              <RowLink href={reportHref(row.id)}>{reportTargetTitle(row)}</RowLink>
              <TargetSub report={row} />
            </span>
          </div>
        ),
      },
      { key: 'reason', header: '신고 사유', cell: (row) => <ReasonCell report={row} /> },
      {
        key: 'agency',
        header: '중개사무소',
        cell: (row) =>
          row.agency ? (
            <span className={s.cellStack}>
              <span className={s.cellStrong}>{row.agency.name}</span>
              <span
                className={(row.agency.warningCount ?? 0) >= 2 ? s.dangerText : s.mutedText}
                style={{ fontSize: 12 }}
              >
                {(row.agency.warningCount ?? 0) > 0
                  ? `누적 경고 ${row.agency.warningCount}회`
                  : '경고 없음'}
              </span>
            </span>
          ) : (
            <span className={s.mutedText}>–</span>
          ),
      },
      { key: 'received', header: '접수', cell: (row) => <ReceivedCell report={row} /> },
      { key: 'status', header: '상태', cell: (row) => <StatusCell report={row} /> },
      {
        key: 'open',
        header: '관리',
        align: 'right',
        cell: (row) => (
          <RowActions>
            <Button
              size="sm"
              variant={isOpen(row.status) ? 'primary' : 'secondary'}
              href={reportHref(row.id)}
              linkAs={Link}
            >
              {isOpen(row.status) ? '처리' : '상세'}
            </Button>
          </RowActions>
        ),
      },
    ],
    [],
  );

  const filtered = hasActiveFilters(values, SPEC, ['status']);
  const queue = tab === 'RECEIVED' || tab === 'IN_REVIEW';
  return (
    <div className={s.page}>
      <ListHead
        label="신고 상태"
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
          label="신고 검색"
          placeholder="단지·건물명, 중개사무소, 신고 내용 검색"
          value={values.q}
          onSearch={(q, mode) => set({ q }, { replace: mode === 'typing' })}
        />
      </ListHead>

      <Panel
        flush
        title={queue ? `${TAB_LABEL[tab]}` : `${TAB_LABEL[tab]} 신고`}
        count={list.data ? formatCount(list.data.total) : undefined}
        description={
          queue ? `접수 후 ${REPORT_SLA_HOURS}시간 안에 처리해 주세요 · 오래된 신고부터` : undefined
        }
        actions={
          <div className={s.filters}>
            {filtered && <ResetFiltersButton onClick={() => reset({ status: tab })} />}
            <FilterSelect
              field="신고 대상"
              options={TARGET_OPTIONS}
              value={values.targetType}
              onChange={(targetType) => set({ targetType })}
            />
          </div>
        }
      >
        <ModList
          caption={`${TAB_LABEL[tab]} 신고 목록`}
          columns={columns}
          rowKey={(row) => row.id}
          rowHref={(row) => reportHref(row.id)}
          data={list.data}
          isPending={list.isPending}
          isFetching={list.isPlaceholderData}
          error={list.error}
          onRetry={() => void list.refetch()}
          footerNote={queue ? '접수 오래된 순' : '최근 접수 순'}
          hrefForPage={(page) => hrefFor({ page })}
          empty={
            filtered
              ? {
                  title: '조건에 맞는 신고가 없어요',
                  description: '검색어나 신고 대상 필터를 바꿔 보세요.',
                  action: (
                    <Button size="sm" variant="secondary" onClick={() => reset({ status: tab })}>
                      필터 초기화
                    </Button>
                  ),
                }
              : queue
                ? {
                    icon: 'check-circle',
                    title:
                      tab === 'RECEIVED' ? '새로 들어온 신고가 없어요' : '검토 중인 신고가 없어요',
                    description: '신고가 접수되면 오래된 순서로 이곳에 쌓여요.',
                  }
                : { icon: 'siren', title: `${TAB_LABEL[tab]} 상태의 신고가 없어요` }
          }
          renderCard={(row) => {
            const sla = reportSlaLabel(row.createdAt, row.status);
            return (
              <ModCard
                href={reportHref(row.id)}
                title={reportTargetTitle(row)}
                badge={
                  <StatusPill tone={REPORT_STATUS_META[row.status].tone}>
                    {REPORT_STATUS_META[row.status].label}
                  </StatusPill>
                }
                meta={
                  <>
                    {row.agency && <span>{row.agency.name}</span>}
                    <span>
                      {formatRelativeTime(row.createdAt)} 접수
                      {sla && (
                        <span className={sla.overdue ? s.dangerText : undefined}>
                          {' '}
                          · {sla.text}
                        </span>
                      )}
                    </span>
                  </>
                }
              >
                <TargetSub report={row} />
                <ReasonCell report={row} />
              </ModCard>
            );
          }}
        />
      </Panel>
    </div>
  );
}
