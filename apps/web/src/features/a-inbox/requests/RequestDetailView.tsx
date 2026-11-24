'use client';
import { DEAL_REQUEST_TYPE_LABEL } from '@house/shared';
import {
  Button,
  Callout,
  EmptyState,
  ErrorState,
  Icon,
  LoadingRegion,
  Panel,
  Skeleton,
  StatusPill,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { agencyKeys, fetchMyAgency } from '@/features/a-agency/api/queries';
import { ConsolePage } from '@/features/a-agency/shell';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateTime, formatRelativeTime } from '@/lib/format';
import { fetchAgencyRequest, inboxKeys, withdrawProposal } from '../api/queries';
import type { AgencyDealRequestDetail, MyProposal } from '../api/schemas';
import { requestTitle } from '../lib/request-text';
import { canPropose, isRequestActive, stagePill } from '../lib/stage';
import { INBOX_ROUTES } from '../routes';
import ui from '../ui/inbox.module.css';
import { TargetedChip, TypeChip } from '../ui/TypeChip';
import { ContactCard } from './ContactCard';
import { MyProposalCard } from './MyProposalCard';
import { ProposalForm } from './ProposalForm';
import { deadlineOf } from './RequestRow';
import { RequestSummary } from './RequestSummary';
import styles from './Requests.module.css';

function BackLink() {
  return (
    <Link href={INBOX_ROUTES.requests} className={ui.back}>
      <Icon name="chevron-left" size={16} />
      요청 목록
    </Link>
  );
}

function DetailSkeleton() {
  return (
    <LoadingRegion label="요청을 불러오는 중">
      <Skeleton width={180} height={22} />
      <Skeleton width="min(420px, 80%)" height={34} style={{ marginTop: 10 }} />
      <Skeleton width="min(320px, 60%)" height={14} style={{ marginTop: 10 }} />
      <div className={styles.cols} style={{ marginTop: 20 }}>
        <div className={styles.col}>
          <Skeleton height={340} radius={16} />
          <Skeleton height={130} radius={16} />
        </div>
        <Skeleton height={460} radius={16} />
      </div>
    </LoadingRegion>
  );
}

export interface RequestDetailViewProps {
  id: string;
  /** Signed-in agent — used by the greeting template of the proposal form. */
  memberName?: string | null;
}

/** /agent/requests/[id] — one request as the agency sees it + the proposal form / our proposal. */
export function RequestDetailView({ id, memberName }: RequestDetailViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: inboxKeys.request(id),
    queryFn: ({ signal }) => fetchAgencyRequest(id, signal),
    // The requester answers elsewhere (accept / open their contact): show it when the agent returns.
    refetchOnWindowFocus: true,
  });
  // Office name for the greeting template (same cache entry as the dashboard / profile pages).
  const agency = useQuery({
    queryKey: agencyKeys.mine,
    queryFn: ({ signal }) => fetchMyAgency(signal),
    staleTime: 5 * 60_000,
  });

  /** Lists, counters and the sidebar badge depend on what happens here. */
  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: inboxKeys.requests });
    void queryClient.invalidateQueries({ queryKey: inboxKeys.dashboard });
  };
  const setProposal = (proposal: MyProposal) => {
    queryClient.setQueryData<AgencyDealRequestDetail>(
      inboxKeys.request(id),
      (old) =>
        old && {
          ...old,
          myProposal: proposal,
          proposalCount: old.myProposal ? old.proposalCount : old.proposalCount + 1,
        },
    );
    refreshLists();
  };

  const withdraw = useMutation({
    mutationFn: (proposalId: string) => withdrawProposal(proposalId),
    onSuccess: (proposal) => {
      setProposal(proposal);
      toast('제안을 철회했어요.');
    },
    onError: (error) => {
      toast({ message: errorMessage(error), tone: 'error' });
      void query.refetch();
    },
  });

  if (query.isPending)
    return (
      <ConsolePage>
        <BackLink />
        <DetailSkeleton />
      </ConsolePage>
    );

  if (query.isError) {
    const notFound = query.error instanceof ApiError && query.error.isNotFound;
    return (
      <ConsolePage>
        <BackLink />
        <Panel>
          {notFound ? (
            <EmptyState
              icon="home-up"
              title="요청을 찾을 수 없어요"
              description="삭제됐거나 우리 사무소에 전달되지 않은 요청이에요."
              action={
                <Button href={INBOX_ROUTES.requests} linkAs={Link} variant="soft">
                  요청 목록으로
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="요청을 불러오지 못했어요"
              description={errorMessage(query.error)}
              onRetry={() => void query.refetch()}
              code={query.error instanceof ApiError ? query.error.requestId : undefined}
            />
          )}
        </Panel>
      </ConsolePage>
    );
  }

  const r = query.data;
  const pill = stagePill(r);
  const deadline = deadlineOf(r);
  const active = isRequestActive(r.status);

  return (
    <ConsolePage>
      <BackLink />
      <header className={styles.detailHead}>
        <div className={styles.detailChips}>
          <TypeChip type={r.type} />
          {r.targeted && <TargetedChip />}
          <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
        </div>
        <h1 className={styles.detailTitle}>{requestTitle(r)}</h1>
        <p className={ui.meta}>
          <span>{DEAL_REQUEST_TYPE_LABEL[r.type]} 요청</span>
          <time dateTime={r.createdAt} title={formatDateTime(r.createdAt)}>
            {formatRelativeTime(r.createdAt)} 등록
          </time>
          {deadline && (
            <span className={deadline.hot ? ui.hot : undefined}>마감 {deadline.label}</span>
          )}
          <span>
            {r.proposalCount > 0 ? (
              <>
                지금까지 제안 <b>{r.proposalCount}</b>곳
              </>
            ) : (
              '아직 받은 제안 없음'
            )}
          </span>
        </p>
      </header>

      <div className={styles.cols}>
        <div className={styles.col}>
          <Panel title="요청 내용">
            <RequestSummary request={r} />
          </Panel>
          <Panel
            title="요청자 연락처"
            description={r.contact ? undefined : '요청자가 동의한 중개사무소에만 공개돼요'}
          >
            <ContactCard request={r} />
          </Panel>
        </div>

        <div className={`${styles.col} ${styles.side}`}>
          {r.myProposal ? (
            <Panel title="보낸 제안">
              <MyProposalCard
                request={r}
                withdrawing={withdraw.isPending}
                onWithdraw={() => r.myProposal && withdraw.mutate(r.myProposal.id)}
              />
            </Panel>
          ) : canPropose(r) ? (
            <Panel
              title="제안 보내기"
              description={r.targeted ? '요청자가 우리 사무소를 직접 골랐어요' : undefined}
            >
              <ProposalForm
                request={r}
                agencyName={agency.data?.name}
                memberName={memberName}
                onSent={setProposal}
                onStale={() => {
                  void query.refetch();
                  refreshLists();
                }}
              />
            </Panel>
          ) : (
            <Panel title="제안">
              <Callout size="sm" icon="info" tone="muted" title="제안을 받지 않는 요청이에요">
                {active
                  ? '지금은 이 요청에 제안할 수 없어요.'
                  : '요청이 종료돼 더 이상 제안을 보낼 수 없어요. 새 요청을 확인해 보세요.'}
              </Callout>
            </Panel>
          )}
        </div>
      </div>
    </ConsolePage>
  );
}
