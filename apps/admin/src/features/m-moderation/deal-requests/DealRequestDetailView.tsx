'use client';
import {
  ASSET_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DealRequestStatus,
  DealRequestType,
  UserStatus,
} from '@house/shared';
import {
  BackLink,
  Badge,
  Button,
  Callout,
  ConfirmDialog,
  Icon,
  Panel,
  StatusPill,
  Tag,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/shell';
import { ADMIN_ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import {
  formatAreaBoth,
  formatDate,
  formatDateTime,
  formatDday,
  formatPhone,
  formatRelativeTime,
} from '@/lib/format';
import d from './deal-requests.module.css';
import { SpamBadge, TypeBadge } from './DealRequestsListView';
import { closeDealRequest, fetchDealRequest, flagDealRequestSpam, modKeys } from '../api/queries';
import type { AdminDealRequestDetail } from '../api/schemas';
import {
  DEAL_REQUEST_STATUS_META,
  DEAL_REQUEST_VISIBILITY_LABEL,
  PROPOSAL_STATUS_META,
  USER_STATUS_META,
  dealRequestArea,
  dealRequestPrice,
  dealRequestSpamState,
  dealRequestTitle,
  historyLabel,
  isModerationAction,
  memberLabel,
  shortId,
} from '../lib/labels';
import { DEAL_REQUEST_CLOSE_PRESETS, DEAL_REQUEST_SPAM_PRESETS } from '../lib/reasons';
import {
  AuditNotice,
  DetailError,
  DetailGrid,
  DetailHero,
  DetailSkeleton,
  InfoList,
  MiniStats,
  Timeline,
  type InfoItem,
} from '../ui/Detail';
import { ReasonDialog } from '../ui/ReasonDialog';
import s from '../ui/ui.module.css';

type Dialog = 'spam' | 'unspam' | 'close' | null;

function requestItems(req: AdminDealRequestDetail): InfoItem[] {
  const sell = req.type === DealRequestType.SELL_OR_LEASE;
  const items: InfoItem[] = [
    { label: '요청 유형', value: <TypeBadge type={req.type} /> },
    { label: '매물 종류', value: ASSET_TYPE_LABEL[req.assetType] },
    {
      label: '거래 유형',
      value: req.dealTypes.map((t) => DEAL_TYPE_LABEL[t]).join(' · '),
    },
    {
      label: sell ? '희망가' : '예산',
      // The row label already says "희망가".
      value: <strong className={s.num}>{dealRequestPrice(req).replace(/^희망가 /, '')}</strong>,
    },
  ];
  if (sell) {
    items.push(
      { label: '단지 · 건물', value: req.complexName },
      {
        label: '전용면적',
        value: req.exclusiveArea ? formatAreaBoth(req.exclusiveArea) : null,
      },
      { label: '층', value: req.floor != null ? `${req.floor}층` : null },
      {
        label: '입주 가능일',
        value: req.moveInDate ? formatDate(req.moveInDate) : null,
      },
      {
        label: '소재지',
        wide: true,
        value: [req.roadAddress, req.addressDetail].filter(Boolean).join(', ') || req.emdName,
      },
    );
  } else {
    items.push(
      { label: '희망 면적', value: dealRequestArea(req) },
      { label: '방 수', value: req.roomsMin != null ? `${req.roomsMin}개 이상` : null },
      {
        label: '입주 희망일',
        value: req.moveInDate ? `${formatDate(req.moveInDate)}까지` : null,
      },
      {
        label: '희망 지역',
        wide: true,
        value:
          req.regionNames.length > 0 ? (
            <span className={d.chips}>
              {req.regionNames.map((name) => (
                <Tag key={name}>{name}</Tag>
              ))}
            </span>
          ) : null,
      },
    );
  }
  items.push(
    {
      label: '공개 범위',
      wide: true,
      value: `${DEAL_REQUEST_VISIBILITY_LABEL[req.visibility]} (${req.targetAgencyCount}곳에 전달)`,
    },
    {
      label: '상세 내용',
      wide: true,
      value: req.description ? <span className={s.prose}>{req.description}</span> : null,
    },
  );
  return items;
}

/** 내놓기·구하기 상세 (`/deal-requests/[id]`): request, requester, offices, proposals + spam / close. */
export function DealRequestDetailView({ id }: { id: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState<Dialog>(null);

  const {
    data: req,
    isPending,
    error,
    refetch,
  } = useQuery({
    queryKey: modKeys.dealRequest(id),
    queryFn: ({ signal }) => fetchDealRequest(id, signal),
  });

  const moderate = useMutation({
    mutationFn: (v: { kind: Exclude<Dialog, null>; reason: string }) =>
      v.kind === 'close'
        ? closeDealRequest(id, v.reason)
        : flagDealRequestSpam(id, v.kind === 'spam', v.reason || undefined),
    onSuccess: (next, v) => {
      queryClient.setQueryData(modKeys.dealRequest(id), next);
      void queryClient.invalidateQueries({ queryKey: ['admin-deal-requests'] });
      toast(
        v.kind === 'spam'
          ? '스팸으로 표시했어요. 중개사무소에 더 이상 노출되지 않아요.'
          : v.kind === 'unspam'
            ? '스팸 표시를 해제했어요. 요청이 다시 노출돼요.'
            : '요청을 종료했어요.',
      );
      setDialog(null);
    },
    onError: (err) => {
      if (dialog === 'unspam') {
        toast({ message: errorMessage(err), tone: 'error' });
        setDialog(null);
      }
    },
  });

  if (isPending) return <DetailSkeleton />;
  if (error || !req)
    return (
      <DetailError
        error={error}
        onRetry={() => void refetch()}
        backHref={ADMIN_ROUTES.dealRequests}
        backLabel="요청 목록으로"
        subject="요청"
      />
    );

  const status = DEAL_REQUEST_STATUS_META[req.status];
  const sell = req.type === DealRequestType.SELL_OR_LEASE;
  const title = dealRequestTitle(req);
  const spam = dealRequestSpamState(req);
  const active = req.status === DealRequestStatus.OPEN || req.status === DealRequestStatus.MATCHED;
  const requester = req.requester;
  const closeDialog = () => {
    setDialog(null);
    moderate.reset();
  };
  const dialogTarget = {
    title,
    sub: `${memberLabel(requester)} · ${formatRelativeTime(req.createdAt)} 등록`,
  };

  return (
    <div className={s.detail}>
      <AdminPageHeader
        title={`${sell ? '내놓기' : '구하기'} 요청`}
        crumb={['운영', { label: '내놓기·구하기', href: ADMIN_ROUTES.dealRequests }]}
      />
      <BackLink linkAs={Link} href={ADMIN_ROUTES.dealRequests}>
        요청 목록
      </BackLink>

      <DetailHero
        icon={
          <span className={`${d.heroIcon} ${sell ? d.iconSell : d.iconWanted}`}>
            <Icon name={sell ? 'home-up' : 'home-search'} size={24} />
          </span>
        }
        eyebrow={
          <>
            {sell ? '내놓기' : '구하기'} 요청 <span className={s.num}>{shortId(req.id)}</span> ·{' '}
            {ASSET_TYPE_LABEL[req.assetType]}
          </>
        }
        title={title}
        badges={
          <>
            <StatusPill tone={status.tone}>{status.label}</StatusPill>
            <SpamBadge request={req} />
          </>
        }
        meta={
          <>
            <strong className={d.heroPrice}>{dealRequestPrice(req)}</strong>
            <span>
              <Icon name="clock" size={14} />
              {formatDateTime(req.createdAt)} 등록
            </span>
            {req.status === DealRequestStatus.OPEN && req.expiresAt && (
              <span>
                <Icon name="calendar" size={14} />
                {formatDate(req.expiresAt)} 만료 ({formatDday(req.expiresAt)})
              </span>
            )}
          </>
        }
      />

      {spam === 'flagged' && (
        <Callout size="sm" tone="danger">
          <strong>스팸으로 표시된 요청이에요.</strong> 중개사무소에 노출되지 않아요.
          {req.spamReason && <> 사유: {req.spamReason}</>}
        </Callout>
      )}
      {spam === 'suspected' && (
        <Callout size="sm" tone="warn">
          <strong>자동 감지 신호가 {req.spamSignalCount}건 있어요.</strong> 내용을 확인한 뒤
          스팸이면 표시해 주세요. 표시하면 대상 중개사무소 {req.targetAgencyCount}곳에서 바로
          내려가요.
        </Callout>
      )}
      {req.status === DealRequestStatus.CLOSED && req.closeReason && (
        <Callout size="sm" tone="muted">
          <strong>종료된 요청이에요.</strong> 사유: {req.closeReason}
        </Callout>
      )}
      <AuditNotice subject="요청자 이름과 연락처" />

      <DetailGrid
        main={
          <>
            <Panel title="요청 내용">
              <InfoList items={requestItems(req)} />
            </Panel>

            <Panel
              title="요청자"
              description="연락처는 요청자가 직접 입력한 값이에요 (인증하지 않음)"
              actions={
                requester ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    href={`${ADMIN_ROUTES.users}/${requester.id}`}
                    linkAs={Link}
                    iconRight={<Icon name="chevron-right" size={16} />}
                  >
                    회원 정보
                  </Button>
                ) : undefined
              }
            >
              <InfoList
                items={[
                  { label: '닉네임', value: memberLabel(requester) },
                  { label: '연락처 이름', value: req.contactName },
                  {
                    label: '연락처',
                    value: req.contactPhone ? (
                      <span className={s.num}>{formatPhone(req.contactPhone)}</span>
                    ) : null,
                  },
                  {
                    label: '회원 상태',
                    value: requester?.status ? (
                      <span
                        className={
                          requester.status === UserStatus.SUSPENDED ? s.dangerText : undefined
                        }
                      >
                        {USER_STATUS_META[requester.status].label}
                      </span>
                    ) : null,
                  },
                  {
                    label: '가입일',
                    value: requester?.createdAt ? formatDate(requester.createdAt) : null,
                  },
                  {
                    label: '등록한 요청',
                    value:
                      requester?.dealRequestCount != null ? (
                        <span className={requester.dealRequestCount >= 5 ? s.warnText : undefined}>
                          {requester.dealRequestCount}건
                        </span>
                      ) : null,
                  },
                ]}
              />
            </Panel>

            <Panel title="중개사 제안" count={req.proposals.length} flush>
              {req.proposals.length === 0 ? (
                <p className={s.actionHint} style={{ padding: 20 }}>
                  아직 제안을 보낸 중개사무소가 없어요.
                </p>
              ) : (
                <ul className={s.rows}>
                  {req.proposals.map((p) => (
                    <li key={p.id} className={d.proposal}>
                      <div className={d.proposalHead}>
                        <span className={s.rowMain}>
                          <Link
                            href={`${ADMIN_ROUTES.agencies}/${p.agencyId}`}
                            className={s.rowTitle}
                          >
                            {p.agencyName}
                          </Link>
                          <span className={s.rowSub}>
                            {formatRelativeTime(p.createdAt)}
                            {p.listingCount ? ` · 추천 매물 ${p.listingCount}건` : ''}
                          </span>
                        </span>
                        <StatusPill tone={PROPOSAL_STATUS_META[p.status].tone}>
                          {PROPOSAL_STATUS_META[p.status].label}
                        </StatusPill>
                      </div>
                      {p.message && <p className={d.proposalMsg}>{p.message}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="전달된 중개사무소" count={req.targets.length} flush>
              {req.targets.length === 0 ? (
                <p className={s.actionHint} style={{ padding: 20 }}>
                  전달된 중개사무소가 없어요.
                </p>
              ) : (
                <ul className={s.rows}>
                  {req.targets.map((t) => {
                    const granted = req.contactGrants.find((g) => g.agencyId === t.agencyId);
                    const proposed = req.proposals.some((p) => p.agencyId === t.agencyId);
                    return (
                      <li key={t.agencyId} className={s.row}>
                        <span className={s.rowMain}>
                          <Link
                            href={`${ADMIN_ROUTES.agencies}/${t.agencyId}`}
                            className={s.rowTitle}
                          >
                            {t.name}
                          </Link>
                          {granted && (
                            <span className={s.rowSub}>
                              {formatDateTime(granted.grantedAt)} 연락처 공개 동의
                            </span>
                          )}
                        </span>
                        <span className={s.rowSide}>
                          {granted && <Badge tone="success">연락처 공개</Badge>}
                          {proposed ? <Badge tone="brand">제안함</Badge> : <Badge>미응답</Badge>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </>
        }
        side={
          <>
            <Panel title="모니터링">
              <div className={d.sideLines}>
                <div className={d.sideLine}>
                  <span>현재 상태</span>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </div>
                <div className={d.sideLine}>
                  <span>스팸 여부</span>
                  {spam === 'clean' ? <Badge>정상</Badge> : <SpamBadge request={req} />}
                </div>
              </div>
              <div className={s.actions}>
                {spam === 'flagged' ? (
                  <Button variant="secondary" block onClick={() => setDialog('unspam')}>
                    스팸 표시 해제
                  </Button>
                ) : (
                  active && (
                    <Button
                      variant="danger"
                      block
                      iconLeft={<Icon name="alert" size={18} />}
                      onClick={() => {
                        moderate.reset();
                        setDialog('spam');
                      }}
                    >
                      스팸으로 표시
                    </Button>
                  )
                )}
                {active && (
                  <Button
                    variant="secondary"
                    block
                    onClick={() => {
                      moderate.reset();
                      setDialog('close');
                    }}
                  >
                    요청 종료
                  </Button>
                )}
                <p className={s.actionHint}>
                  {active
                    ? '스팸 표시는 되돌릴 수 있고, 종료는 되돌릴 수 없어요. 처리 내용은 요청자에게 알림으로 전달되고 작업 기록에 남아요.'
                    : `${status.label} 상태의 요청이에요. 더 이상 중개사무소에 노출되지 않아요.`}
                </p>
              </div>
            </Panel>

            {req.spamSignals.length > 0 && (
              <Panel title="자동 감지 신호" count={req.spamSignals.length}>
                <ul className={d.signals}>
                  {req.spamSignals.map((signal) => (
                    <li key={signal} className={d.signal}>
                      <Icon name="alert" size={16} />
                      {signal}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            <Panel title="진행 현황">
              <MiniStats
                items={[
                  { label: '전달', value: req.targetAgencyCount, unit: '곳' },
                  { label: '제안', value: req.proposalCount, unit: '건' },
                  { label: '연락처 공개', value: req.contactGrants.length, unit: '곳' },
                ]}
              />
            </Panel>

            <Panel title="이력" count={req.history.length}>
              <Timeline
                label="요청 이력"
                items={req.history.map((h) => ({
                  id: h.id,
                  tone: isModerationAction(h.action)
                    ? 'danger'
                    : h.action === 'DEAL_REQUEST_CREATED'
                      ? 'brand'
                      : h.action === 'DEAL_REQUEST_MATCHED' || h.action === 'CONTACT_GRANTED'
                        ? 'success'
                        : 'default',
                  title: historyLabel(h.action),
                  meta: [h.actorName, formatDateTime(h.createdAt)].filter(Boolean).join(' · '),
                  note: h.note ?? undefined,
                }))}
              />
            </Panel>
          </>
        }
      />

      <ReasonDialog
        open={dialog === 'spam'}
        onClose={closeDialog}
        title="스팸으로 표시"
        description={`표시하면 대상 중개사무소 ${req.targetAgencyCount}곳의 요청함에서 바로 내려가요. 요청은 삭제되지 않고, 언제든 해제할 수 있어요.`}
        target={dialogTarget}
        reasonLabel="표시 사유"
        presets={DEAL_REQUEST_SPAM_PRESETS}
        confirmLabel="스팸으로 표시"
        danger
        loading={moderate.isPending}
        error={moderate.isError && dialog === 'spam' ? errorMessage(moderate.error) : null}
        onConfirm={(reason) => moderate.mutate({ kind: 'spam', reason })}
      />
      <ReasonDialog
        open={dialog === 'close'}
        onClose={closeDialog}
        title="요청 종료"
        description="종료하면 요청이 중개사무소에서 내려가고 새 제안을 받을 수 없어요. 되돌릴 수 없으니 확인한 뒤 진행해 주세요."
        target={dialogTarget}
        reasonLabel="종료 사유"
        presets={DEAL_REQUEST_CLOSE_PRESETS}
        confirmLabel="요청 종료"
        danger
        loading={moderate.isPending}
        error={moderate.isError && dialog === 'close' ? errorMessage(moderate.error) : null}
        onConfirm={(reason) => moderate.mutate({ kind: 'close', reason })}
      />
      <ConfirmDialog
        open={dialog === 'unspam'}
        onClose={() => setDialog(null)}
        onConfirm={() => moderate.mutate({ kind: 'unspam', reason: '' })}
        title="스팸 표시를 해제할까요?"
        description="해제하면 요청이 대상 중개사무소의 요청함에 다시 노출돼요."
        confirmLabel="표시 해제"
        loading={moderate.isPending}
      />
    </div>
  );
}
