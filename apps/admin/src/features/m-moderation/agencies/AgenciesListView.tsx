'use client';
import { AGENCY_STATUS_LABEL, AgencyStatus } from '@house/shared';
import {
  Badge,
  Button,
  ConfirmDialog,
  Icon,
  ListSearchField,
  Panel,
  StatusPill,
  useToast,
  type TableColumn,
} from '@house/ui';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { errorMessage } from '@/lib/api';
import { formatCount, formatDateShort, formatPhone } from '@/lib/format';
import { MOD_PAGE_SIZE, decideAgency, fetchAgencies, fetchCounts, modKeys } from '../api/queries';
import type { AdminAgencyListItem } from '../api/schemas';
import {
  AGENCY_STATUS_META,
  REGISTRY_STATUS_META,
  documentSummary,
  readyToApprove,
  waitingDays,
  waitingLabel,
} from '../lib/labels';
import type { ParamSpec } from '../lib/list-params';
import { AGENCY_REJECT_PRESETS } from '../lib/reasons';
import { useListParams } from '../lib/use-list-params';
import { ListHead, ModCard, ModList, RowActions, RowLink } from '../ui/ModList';
import { ReasonDialog } from '../ui/ReasonDialog';
import s from '../ui/ui.module.css';

const TAB_VALUES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED', 'ALL'] as const;
type Tab = (typeof TAB_VALUES)[number];

const SPEC = {
  status: { kind: 'enum', values: TAB_VALUES, fallback: 'PENDING' },
  q: { kind: 'text' },
} as const satisfies ParamSpec;

const TAB_LABEL: Record<Tab, string> = {
  PENDING: '승인 대기',
  APPROVED: AGENCY_STATUS_LABEL.APPROVED,
  REJECTED: AGENCY_STATUS_LABEL.REJECTED,
  SUSPENDED: AGENCY_STATUS_LABEL.SUSPENDED,
  ALL: '전체',
};

const COUNT_QUERIES = {
  PENDING: { status: 'PENDING' },
  APPROVED: { status: 'APPROVED' },
  REJECTED: { status: 'REJECTED' },
  SUSPENDED: { status: 'SUSPENDED' },
  ALL: {},
} as const;

export const agencyHref = (id: string) => `/agencies/${id}`;

/** True when nothing blocks a one-click approval from the queue. */
const canQuickApprove = (a: AdminAgencyListItem): boolean =>
  a.documentTypes !== null &&
  readyToApprove(documentSummary(a.documentTypes).complete, a.registryStatus);

function DocumentsCell({ agency }: { agency: AdminAgencyListItem }) {
  // The list view only counts the documents; which ones are missing is checked on the detail page.
  if (agency.documentTypes === null)
    return (
      <span className={s.mutedText}>
        {agency.documentCount ? `서류 ${formatCount(agency.documentCount)}건` : '서류 없음'}
      </span>
    );
  const docs = documentSummary(agency.documentTypes);
  return (
    <span className={`${s.inlineIcon} ${docs.complete ? s.okText : s.warnText}`}>
      <Icon name={docs.complete ? 'check-circle' : 'alert'} size={16} />
      {docs.label}
    </span>
  );
}

function RegistryCell({ agency }: { agency: AdminAgencyListItem }) {
  // The list has no registry result (it is looked up on the detail page and cached there).
  if (!agency.registryStatus) return <span className={s.mutedText}>상세에서 조회</span>;
  const meta = REGISTRY_STATUS_META[agency.registryStatus];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

function AppliedCell({ agency }: { agency: AdminAgencyListItem }) {
  const days = waitingDays(agency.createdAt);
  return (
    <span className={s.cellStack}>
      <span className={s.num}>{formatDateShort(agency.createdAt)}</span>
      {agency.status === AgencyStatus.PENDING && (
        <span className={days >= 3 ? s.warnText : s.mutedText} style={{ fontSize: 12 }}>
          {waitingLabel(days)}
        </span>
      )}
    </span>
  );
}

/** 중개사무소 승인 queue + office search (`/agencies`). */
export function AgenciesListView() {
  const { values, set, reset, hrefFor } = useListParams(SPEC);
  const tab = values.status as Tab;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState<AdminAgencyListItem | null>(null);
  const [rejecting, setRejecting] = useState<AdminAgencyListItem | null>(null);

  const query = useMemo(
    () => ({
      status: tab === 'ALL' ? undefined : tab,
      q: values.q || undefined,
      page: values.page,
      pageSize: MOD_PAGE_SIZE,
    }),
    [tab, values.q, values.page],
  );
  const list = useQuery({
    queryKey: modKeys.agencies(query),
    queryFn: ({ signal }) => fetchAgencies(query, signal),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: modKeys.agencyCounts,
    queryFn: ({ signal }) => fetchCounts('/admin/agencies', COUNT_QUERIES, signal),
  });

  const decision = useMutation({
    mutationFn: (v: {
      agency: AdminAgencyListItem;
      status: 'APPROVED' | 'REJECTED';
      reason?: string;
    }) => decideAgency(v.agency.id, { status: v.status, reason: v.reason }),
    onSuccess: (_data, v) => {
      toast(
        v.status === 'APPROVED'
          ? `${v.agency.name}을(를) 승인했어요. 신청자에게 알림을 보냈어요.`
          : `${v.agency.name} 신청을 반려했어요.`,
      );
      setApproving(null);
      setRejecting(null);
      void queryClient.invalidateQueries({ queryKey: ['admin-agencies'] });
    },
    onError: (error) => {
      // The reject dialog shows its error inline; approvals report through a toast.
      if (!rejecting) toast({ message: errorMessage(error), tone: 'error' });
      setApproving(null);
    },
  });

  const columns = useMemo<TableColumn<AdminAgencyListItem>[]>(() => {
    const office: TableColumn<AdminAgencyListItem> = {
      key: 'name',
      header: '상호',
      cell: (a) => (
        <div className={s.cellMain}>
          <span className={s.cellIcon}>
            <Icon name="store" size={18} />
          </span>
          <span className={s.cellText}>
            <RowLink href={agencyHref(a.id)}>{a.name}</RowLink>
            <span className={s.cellSub}>
              {[a.emdName, a.phone ? formatPhone(a.phone) : null].filter(Boolean).join(' · ')}
            </span>
          </span>
        </div>
      ),
    };
    const rep: TableColumn<AdminAgencyListItem> = {
      key: 'rep',
      header: '대표 · 등록번호',
      cell: (a) => (
        <span className={s.cellStack}>
          <span className={s.cellStrong}>{a.representativeName}</span>
          <span className={s.mono}>{a.registrationNumber}</span>
        </span>
      ),
    };
    if (tab === 'PENDING') {
      return [
        office,
        rep,
        { key: 'docs', header: '서류', cell: (a) => <DocumentsCell agency={a} /> },
        { key: 'registry', header: '등록 조회', cell: (a) => <RegistryCell agency={a} /> },
        { key: 'applied', header: '신청일', cell: (a) => <AppliedCell agency={a} /> },
        {
          key: 'actions',
          header: '관리',
          align: 'right',
          cell: (a) => (
            <RowActions>
              <Button size="sm" variant="danger" onClick={() => setRejecting(a)}>
                반려
              </Button>
              {canQuickApprove(a) ? (
                <Button size="sm" onClick={() => setApproving(a)}>
                  승인
                </Button>
              ) : (
                <Button size="sm" variant="soft" href={agencyHref(a.id)} linkAs={Link}>
                  심사하기
                </Button>
              )}
            </RowActions>
          ),
        },
      ];
    }
    return [
      office,
      rep,
      {
        key: 'status',
        header: '상태',
        cell: (a) => (
          <StatusPill tone={AGENCY_STATUS_META[a.status].tone}>
            {AGENCY_STATUS_META[a.status].label}
          </StatusPill>
        ),
      },
      {
        key: 'listings',
        header: '광고 매물',
        align: 'right',
        cell: (a) =>
          a.activeListingCount === null ? (
            <span className={s.mutedText}>–</span>
          ) : (
            <span className={s.num}>{formatCount(a.activeListingCount)}건</span>
          ),
      },
      {
        key: 'warnings',
        header: '경고',
        align: 'right',
        cell: (a) =>
          a.warningCount > 0 ? (
            <span className={`${s.num} ${a.warningCount >= 2 ? s.dangerText : s.warnText}`}>
              {a.warningCount}회
            </span>
          ) : (
            <span className={s.mutedText}>–</span>
          ),
      },
      {
        key: 'date',
        header: tab === 'APPROVED' ? '승인일' : '신청일',
        cell: (a) => (
          <span className={s.num}>
            {formatDateShort(tab === 'APPROVED' ? (a.approvedAt ?? a.createdAt) : a.createdAt)}
          </span>
        ),
      },
      {
        key: 'open',
        header: '관리',
        align: 'right',
        cell: (a) => (
          <RowActions>
            <Button size="sm" variant="secondary" href={agencyHref(a.id)} linkAs={Link}>
              상세
            </Button>
          </RowActions>
        ),
      },
    ];
  }, [tab]);

  const total = list.data?.total;
  return (
    <div className={s.page}>
      <ListHead
        label="중개사무소 상태"
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
          label="중개사무소 검색"
          placeholder="상호, 대표자, 등록번호 검색"
          value={values.q}
          onSearch={(q, mode) => set({ q }, { replace: mode === 'typing' })}
        />
      </ListHead>

      <Panel
        flush
        title={tab === 'PENDING' ? '승인 대기 중개사무소' : `${TAB_LABEL[tab]} 중개사무소`}
        count={total !== undefined ? formatCount(total) : undefined}
        description={
          tab === 'PENDING'
            ? '등록번호는 국가공간정보 중개업 조회로 자동 대조합니다 · 오래된 신청부터'
            : undefined
        }
      >
        <ModList
          caption={`${TAB_LABEL[tab]} 중개사무소 목록`}
          columns={columns}
          rowKey={(a) => a.id}
          rowHref={(a) => agencyHref(a.id)}
          data={list.data}
          isPending={list.isPending}
          isFetching={list.isPlaceholderData}
          error={list.error}
          onRetry={() => void list.refetch()}
          unit="곳"
          footerNote={tab === 'PENDING' ? '신청일 오래된 순' : '최근 신청 순'}
          hrefForPage={(page) => hrefFor({ page })}
          empty={
            values.q
              ? {
                  title: `'${values.q}' 검색 결과가 없어요`,
                  description: '상호, 대표자 이름, 등록번호를 다시 확인해 주세요.',
                  action: (
                    <Button size="sm" variant="secondary" onClick={() => reset({ status: tab })}>
                      검색 지우기
                    </Button>
                  ),
                }
              : tab === 'PENDING'
                ? {
                    icon: 'check-circle',
                    title: '승인을 기다리는 신청이 없어요',
                    description: '새 신청이 들어오면 이곳에 오래된 순서로 쌓여요.',
                  }
                : { icon: 'store', title: `${TAB_LABEL[tab]} 상태의 중개사무소가 없어요` }
          }
          renderCard={(a) => (
            <ModCard
              href={agencyHref(a.id)}
              title={a.name}
              badge={
                <StatusPill tone={AGENCY_STATUS_META[a.status].tone}>
                  {AGENCY_STATUS_META[a.status].label}
                </StatusPill>
              }
              meta={
                <>
                  <span>
                    {a.representativeName} · <span className={s.num}>{a.registrationNumber}</span>
                  </span>
                  <span>
                    {a.emdName ?? a.roadAddress} · 신청 {formatDateShort(a.createdAt)}
                    {a.status === 'PENDING' && ` · ${waitingLabel(waitingDays(a.createdAt))}`}
                  </span>
                </>
              }
              actions={
                a.status === 'PENDING' ? (
                  <>
                    <Button size="sm" variant="danger" onClick={() => setRejecting(a)}>
                      반려
                    </Button>
                    {canQuickApprove(a) ? (
                      <Button size="sm" onClick={() => setApproving(a)}>
                        승인
                      </Button>
                    ) : (
                      <Button size="sm" variant="soft" href={agencyHref(a.id)} linkAs={Link}>
                        심사하기
                      </Button>
                    )}
                  </>
                ) : undefined
              }
            >
              {a.status === 'PENDING' && (
                <div className={s.tagRow}>
                  <DocumentsCell agency={a} />
                  <RegistryCell agency={a} />
                </div>
              )}
            </ModCard>
          )}
        />
      </Panel>

      <ConfirmDialog
        open={!!approving}
        onClose={() => setApproving(null)}
        onConfirm={() => approving && decision.mutate({ agency: approving, status: 'APPROVED' })}
        title="이 중개사무소를 승인할까요?"
        description={
          approving
            ? `${approving.name} (대표 ${approving.representativeName}) — 서류와 등록 조회가 모두 확인됐어요. 승인하면 대표 계정이 개업공인중개사 권한을 받고 매물을 등록할 수 있어요.`
            : undefined
        }
        confirmLabel="승인"
        loading={decision.isPending}
      />
      <ReasonDialog
        open={!!rejecting}
        onClose={() => {
          setRejecting(null);
          decision.reset();
        }}
        title="신청 반려"
        description="반려 사유는 신청자에게 그대로 전달돼요. 무엇을 고쳐 다시 신청하면 되는지 알려 주세요."
        target={
          rejecting
            ? {
                title: rejecting.name,
                sub: `대표 ${rejecting.representativeName} · ${rejecting.registrationNumber}`,
              }
            : undefined
        }
        reasonLabel="반려 사유"
        presets={AGENCY_REJECT_PRESETS}
        maxLength={1000}
        confirmLabel="반려"
        danger
        loading={decision.isPending}
        error={decision.isError && rejecting ? errorMessage(decision.error) : null}
        onConfirm={(reason) =>
          rejecting && decision.mutate({ agency: rejecting, status: 'REJECTED', reason })
        }
      />
    </div>
  );
}
