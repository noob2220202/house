'use client';
import {
  ASSET_TYPE_LABEL,
  DEAL_TYPE_LABEL,
  DealRequestStatus,
  DealRequestType,
  ProposalStatus,
} from '@house/shared';
import {
  Button,
  Checkbox,
  ConfirmDialog,
  DealBadge,
  EmptyState,
  ErrorState,
  Icon,
  Modal,
  PhotoPlaceholder,
  StatusPill,
  Tag,
  dealKindOf,
  photoKindForAsset,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { formatDate, formatDateKorean, formatDday, formatPhone } from '@/lib/format';
import { dealApi, dealKeys } from '../../api/client';
import type { DealRequestDetail, Proposal } from '../../api/schemas';
import {
  isProposalPending,
  isRequestActive,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_TONE,
  VISIBILITY_LABEL,
} from '../../lib/labels';
import { regionName } from '../../lib/regions';
import {
  requestAreaText,
  requestPriceLines,
  requestSubtitle,
  requestTitle,
  splitDescription,
} from '../../lib/summary';
import { CompareDialog } from './CompareDialog';
import { ProposalCard } from './ProposalCard';
import { RequestKindTag } from './RequestCard';
import styles from './requests.module.css';

const MAX_COMPARE = 3;

type Dialog =
  | { kind: 'accept'; proposal: Proposal }
  | { kind: 'decline'; proposal: Proposal }
  | { kind: 'grant'; proposal: Proposal }
  | { kind: 'revoke'; proposal: Proposal }
  | { kind: 'stop' }
  | { kind: 'compare' }
  | null;

function Private() {
  return (
    <span className={styles.private}>
      <Icon name="lock" size={12} />
      동의한 중개사에게만
    </span>
  );
}

/** Text of what a contact grant reveals: "김하늘 · 010-0000-1234 · 103동 1502호". */
export function revealTextOf(r: DealRequestDetail): string {
  return [r.contactName, formatPhone(r.contactPhone), r.addressDetail].filter(Boolean).join(' · ');
}

/** Proposals in display order: waiting for an answer first (newest first), then answered ones. */
export function sortProposals(proposals: readonly Proposal[]): Proposal[] {
  const rank = (p: Proposal) =>
    p.status === ProposalStatus.ACCEPTED ? 0 : isProposalPending(p.status) ? 1 : 2;
  return [...proposals].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
}

export interface RequestDetailViewProps {
  initial: DealRequestDetail;
  /** Server "now" (ISO) — keeps relative times identical during hydration. */
  now: string;
}

/**
 * /me/requests/[id]: the request, the proposals it received, comparing them, accepting /
 * declining, per-agency contact consent and stopping the request.
 */
export function RequestDetailView({ initial, now }: RequestDetailViewProps) {
  const { toast } = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = initial.id;
  const query = useQuery({
    queryKey: dealKeys.detail(id),
    queryFn: ({ signal }) => dealApi.getMine(id, signal),
    initialData: initial,
    staleTime: 15_000,
  });
  const r = query.data;
  const [dialog, setDialog] = useState<Dialog>(null);
  // Revealing personal data is opt-in: never pre-checked.
  const [reveal, setReveal] = useState(false);
  const [stopKind, setStopKind] = useState<'close' | 'cancel'>('close');
  const [picked, setPicked] = useState<string[]>([]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: dealKeys.detail(id) });
    router.refresh(); // the list / my-page badges are server-rendered
  };
  const fail = (e: unknown) => toast({ message: errorMessage(e), tone: 'error' });

  const accept = useMutation({
    mutationFn: ({ proposal, grant }: { proposal: Proposal; grant: boolean }) =>
      dealApi.acceptProposal(proposal.id, grant),
    onSuccess: (_d, { proposal, grant }) => {
      toast(
        grant
          ? `${proposal.agency.name}의 제안을 수락하고 연락처를 공개했어요.`
          : `${proposal.agency.name}의 제안을 수락했어요.`,
      );
      setDialog(null);
    },
    onError: fail,
    onSettled: refresh,
  });
  const decline = useMutation({
    mutationFn: (proposal: Proposal) => dealApi.declineProposal(proposal.id),
    onSuccess: (_d, proposal) => {
      toast({ message: `${proposal.agency.name}의 제안을 거절했어요.`, tone: 'info' });
      setPicked((list) => list.filter((x) => x !== proposal.id));
      setDialog(null);
    },
    onError: fail,
    onSettled: refresh,
  });
  const contact = useMutation({
    mutationFn: ({ proposal, grant }: { proposal: Proposal; grant: boolean }) =>
      grant
        ? dealApi.grantContact(id, proposal.agencyId)
        : dealApi.revokeContact(id, proposal.agencyId),
    onSuccess: (_d, { proposal, grant }) => {
      toast(
        grant
          ? `${proposal.agency.name}에 연락처를 공개했어요.`
          : { message: `${proposal.agency.name}에 공개한 연락처를 다시 숨겼어요.`, tone: 'info' },
      );
      setDialog(null);
    },
    onError: fail,
    onSettled: refresh,
  });
  const stop = useMutation({
    mutationFn: (kind: 'close' | 'cancel') =>
      kind === 'close' ? dealApi.close(id) : dealApi.cancel(id),
    onSuccess: (updated, kind) => {
      queryClient.setQueryData(dealKeys.detail(id), updated);
      toast(kind === 'close' ? '요청을 종료했어요.' : '요청을 취소했어요.');
      setDialog(null);
      router.refresh();
    },
    onError: fail,
  });
  const busy = accept.isPending || decline.isPending || contact.isPending || stop.isPending;

  const sell = r.type === DealRequestType.SELL_OR_LEASE;
  const active = isRequestActive(r.status);
  const proposals = sortProposals(r.proposals);
  const pendingList = proposals.filter((p) => isProposalPending(p.status));
  const comparable = active ? pendingList : [];
  const compared = comparable.filter((p) => picked.includes(p.id));
  const compareSet = compared.length >= 2 ? compared : comparable.slice(0, MAX_COMPARE);
  const prices = requestPriceLines(r);
  const cover = r.photos[0]?.variants.thumb?.url;
  const { flags, text } = splitDescription(r.description);
  const revealText = revealTextOf(r);

  const facts: [string, ReactNode][] = [
    ['등록일', formatDate(r.createdAt)],
    active && r.expiresAt
      ? [
          '제안 마감',
          <>
            {formatDate(r.expiresAt)} ·{' '}
            <span style={{ whiteSpace: 'nowrap' }}>{formatDday(r.expiresAt, now)}</span>
          </>,
        ]
      : [
          '종료일',
          r.closedAt ? formatDate(r.closedAt) : r.expiresAt ? formatDate(r.expiresAt) : '-',
        ],
    ['전달 범위', `${VISIBILITY_LABEL[r.visibility]} ${r.targetAgencyCount}곳`],
    [
      '받은 제안',
      `${r.proposals.length}건${pendingList.length > 0 && active ? ` · 답변 대기 ${pendingList.length}` : ''}`,
    ],
  ];

  return (
    <div className={styles.detail}>
      {query.isError && (
        <ErrorState
          compact
          title="최신 정보를 불러오지 못했어요"
          description="아래 내용은 조금 전 정보일 수 있어요."
          onRetry={() => void query.refetch()}
        />
      )}
      {r.status === DealRequestStatus.MATCHED && (
        <p className={`${styles.banner} ${styles.bannerOk}`}>
          <Icon name="check-circle" size={18} />
          <span>
            중개사무소를 선택했어요. 거래가 끝났거나 더 이상 제안이 필요 없으면 요청을 종료해
            주세요.
          </span>
        </p>
      )}
      {!active && (
        <p className={styles.banner}>
          <Icon name="info" size={18} />
          <span>
            {r.status === DealRequestStatus.EXPIRED
              ? '제안 기간(30일)이 끝난 요청이에요. 계속 진행하려면 새로 등록해 주세요.'
              : r.status === DealRequestStatus.CANCELLED
                ? '취소한 요청이에요. 중개사무소에는 더 이상 보이지 않아요.'
                : '종료한 요청이에요. 중개사무소에는 더 이상 보이지 않아요.'}
          </span>
        </p>
      )}

      <section className={styles.hero} aria-labelledby="req-title">
        <div className={styles.heroTop}>
          <span className={styles.heroPh}>
            {cover ? (
              <Image src={cover} alt="" fill sizes="88px" unoptimized />
            ) : (
              <PhotoPlaceholder kind={photoKindForAsset(r.assetType)} />
            )}
          </span>
          <div className={styles.heroText}>
            <div className={styles.tags}>
              <RequestKindTag type={r.type} />
              {r.dealTypes.map((d) => (
                <DealBadge key={d} deal={dealKindOf(d)}>
                  {DEAL_TYPE_LABEL[d]}
                </DealBadge>
              ))}
              <StatusPill tone={REQUEST_STATUS_TONE[r.status]}>
                {REQUEST_STATUS_LABEL[r.status]}
              </StatusPill>
            </div>
            <h2 id="req-title" className={styles.heroName}>
              {requestTitle(r)}
            </h2>
            <p className="t-sm">
              {[ASSET_TYPE_LABEL[r.assetType], requestSubtitle(r)].filter(Boolean).join(' · ')}
            </p>
          </div>
          {prices.length > 0 && (
            <div className={styles.heroPrice}>
              {prices.map((p) => (
                <div key={p.label}>
                  <span className="t-cap">{p.label}</span>
                  <span className={`price price-sm ${styles.v}`}>{p.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <dl className={styles.facts}>
          {facts.map(([label, value]) => (
            <div key={label} className={styles.fact}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        <details className={styles.more}>
          <summary>
            내가 보낸 요청 내용
            <Icon name="chevron-down" size={18} />
          </summary>
          <dl className={styles.dl}>
            {sell ? (
              <>
                <div>
                  <dt>주소</dt>
                  <dd>
                    {r.roadAddress ?? '-'}
                    {r.addressDetail && (
                      <>
                        {' '}
                        {r.addressDetail}
                        <Private />
                      </>
                    )}
                  </dd>
                </div>
                {requestAreaText(r) && (
                  <div>
                    <dt>전용면적</dt>
                    <dd>{requestAreaText(r)}</dd>
                  </div>
                )}
                <div>
                  <dt>입주 가능일</dt>
                  <dd>{r.moveInDate ? formatDateKorean(r.moveInDate) : '즉시 입주 또는 협의'}</dd>
                </div>
              </>
            ) : (
              <>
                <div>
                  <dt>희망 지역</dt>
                  <dd>{r.regionCodes.map((c) => regionName(c)).join(', ') || '-'}</dd>
                </div>
                <div>
                  <dt>면적 · 방 수</dt>
                  <dd>
                    {[
                      requestAreaText(r) || '면적 상관없음',
                      typeof r.roomsMin === 'number' ? `방 ${r.roomsMin}개 이상` : '방 수 상관없음',
                    ].join(' · ')}
                  </dd>
                </div>
                <div>
                  <dt>입주 희망일</dt>
                  <dd>{r.moveInDate ? formatDateKorean(r.moveInDate) : '상관없음'}</dd>
                </div>
              </>
            )}
            {(flags.length > 0 || text) && (
              <div>
                <dt>{sell ? '매물 설명' : '요청 사항'}</dt>
                <dd>
                  {flags.length > 0 && (
                    <span className={styles.flags}>
                      {flags.map((f) => (
                        <Tag key={f}>{f}</Tag>
                      ))}
                    </span>
                  )}
                  {text}
                </dd>
              </div>
            )}
            {r.photos.length > 0 && (
              <div>
                <dt>사진</dt>
                <dd>
                  <span className={styles.photos}>
                    {r.photos.map((m, i) => (
                      <span key={m.id} className={styles.photo}>
                        {m.variants.thumb?.url && (
                          <Image
                            src={m.variants.thumb.url}
                            alt={`올린 사진 ${i + 1}`}
                            fill
                            sizes="96px"
                            unoptimized
                          />
                        )}
                      </span>
                    ))}
                  </span>
                </dd>
              </div>
            )}
            <div>
              <dt>연락처</dt>
              <dd>
                {r.contactName} · <span className="num">{formatPhone(r.contactPhone)}</span>
                <Private />
              </dd>
            </div>
            {r.targetAgencies.length > 0 && (
              <div>
                <dt>선택한 중개사</dt>
                <dd>{r.targetAgencies.map((a) => a.name).join(', ')}</dd>
              </div>
            )}
          </dl>
        </details>

        {active && (
          <div className={styles.heroFt}>
            <span className="t-cap">
              요청을 종료하면 중개사무소에 더 이상 보이지 않고, 새 제안도 오지 않아요.
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setStopKind(r.status === DealRequestStatus.MATCHED ? 'close' : 'cancel');
                setDialog({ kind: 'stop' });
              }}
              disabled={busy}
            >
              요청 중단하기
            </Button>
          </div>
        )}
        {!active && (
          <div className={styles.heroFt}>
            <span className="t-cap">같은 조건으로 다시 제안을 받고 싶다면 새로 등록해 주세요.</span>
            <Button
              href={sell ? ROUTES.dealSell : ROUTES.dealFind}
              linkAs={Link}
              variant="secondary"
              iconRight={<Icon name="arrow-right" size={18} />}
            >
              {sell ? '내놓기 새로 등록' : '구하기 새로 등록'}
            </Button>
          </div>
        )}
      </section>

      <div className={styles.secHd}>
        <h2 className="t-h3">
          받은 제안<b className="num">{r.proposals.length}</b>
        </h2>
        {comparable.length >= 2 && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            iconLeft={<Icon name="list" size={16} />}
            onClick={() => setDialog({ kind: 'compare' })}
          >
            제안 비교
          </Button>
        )}
      </div>

      {proposals.length === 0 ? (
        <EmptyState
          className={styles.state}
          icon="bell"
          title={active ? '아직 도착한 제안이 없어요' : '받은 제안이 없어요'}
          description={
            active
              ? '보통 하루 안에 첫 제안이 도착해요. 제안이 오면 알림으로 알려드릴게요.'
              : undefined
          }
        />
      ) : (
        <ul className={styles.proposals}>
          {proposals.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              active={active}
              revealText={revealText}
              revealHint={r.addressDetail ? '이름·휴대폰 번호와 상세 주소' : '이름과 휴대폰 번호'}
              now={now}
              busy={busy}
              onAccept={() => {
                setReveal(false);
                setDialog({ kind: 'accept', proposal: p });
              }}
              onDecline={() => setDialog({ kind: 'decline', proposal: p })}
              onToggleContact={(grant) =>
                setDialog({ kind: grant ? 'grant' : 'revoke', proposal: p })
              }
              compare={
                comparable.length >= 2
                  ? {
                      checked: picked.includes(p.id),
                      disabled: picked.length >= MAX_COMPARE,
                      onChange: (on) =>
                        setPicked((list) =>
                          on ? [...list, p.id] : list.filter((x) => x !== p.id),
                        ),
                    }
                  : undefined
              }
            />
          ))}
        </ul>
      )}

      {compared.length >= 2 && (
        <div className={styles.compareBar} role="region" aria-label="비교함">
          <span>{compared.length}곳 선택됨</span>
          <div>
            <button type="button" className={styles.clear} onClick={() => setPicked([])}>
              선택 해제
            </button>
            <Button type="button" onClick={() => setDialog({ kind: 'compare' })}>
              비교하기
            </Button>
          </div>
        </div>
      )}

      <CompareDialog
        open={dialog?.kind === 'compare'}
        onClose={() => setDialog(null)}
        proposals={compareSet}
        now={now}
        busy={busy}
        onAccept={(p) => {
          setReveal(false);
          setDialog({ kind: 'accept', proposal: p });
        }}
        onDecline={(p) => setDialog({ kind: 'decline', proposal: p })}
      />

      <Modal
        open={dialog?.kind === 'accept'}
        onClose={() => setDialog(null)}
        title="이 제안을 수락할까요?"
        description={
          dialog?.kind === 'accept'
            ? `${dialog.proposal.agency.name}에 수락 알림이 전달돼요. 다른 제안도 계속 받을 수 있어요.`
            : undefined
        }
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
              취소
            </Button>
            <Button
              type="button"
              loading={accept.isPending}
              onClick={() =>
                dialog?.kind === 'accept' &&
                accept.mutate({ proposal: dialog.proposal, grant: reveal })
              }
            >
              수락하기
            </Button>
          </>
        }
      >
        {dialog?.kind === 'accept' && (
          <div className={styles.dialogBody}>
            {dialog.proposal.contactGranted ? (
              <p className="t-sm">이 중개사무소에는 이미 연락처를 공개했어요.</p>
            ) : (
              <>
                <Checkbox checked={reveal} onChange={(e) => setReveal(e.target.checked)}>
                  이 중개사무소에 내 연락처 공개
                </Checkbox>
                <p className={styles.reveal}>
                  <span>공개되는 정보</span>
                  <b>{revealText}</b>
                </p>
              </>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={dialog?.kind === 'decline'}
        onClose={() => setDialog(null)}
        onConfirm={() => dialog?.kind === 'decline' && decline.mutate(dialog.proposal)}
        title="이 제안을 거절할까요?"
        description={
          dialog?.kind === 'decline'
            ? `${dialog.proposal.agency.name}에 거절 알림이 전달되고, 되돌릴 수 없어요.`
            : undefined
        }
        confirmLabel="거절하기"
        danger
        loading={decline.isPending}
      />

      <ConfirmDialog
        open={dialog?.kind === 'grant'}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          dialog?.kind === 'grant' && contact.mutate({ proposal: dialog.proposal, grant: true })
        }
        title="연락처를 공개할까요?"
        description={
          dialog?.kind === 'grant' ? (
            <>
              <b>{dialog.proposal.agency.name}</b>에서 아래 정보를 볼 수 있게 돼요. 공개한 뒤에도
              언제든 다시 비공개로 바꿀 수 있어요.
              <span className={`${styles.reveal} ${styles.revealGap}`}>
                <span>공개되는 정보</span>
                <b>{revealText}</b>
              </span>
            </>
          ) : undefined
        }
        confirmLabel="연락처 공개하기"
        loading={contact.isPending}
      />

      <ConfirmDialog
        open={dialog?.kind === 'revoke'}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          dialog?.kind === 'revoke' && contact.mutate({ proposal: dialog.proposal, grant: false })
        }
        title="연락처를 다시 숨길까요?"
        description={
          dialog?.kind === 'revoke'
            ? `${dialog.proposal.agency.name}에서 더 이상 내 연락처${r.addressDetail ? '와 상세 주소' : ''}를 볼 수 없어요.`
            : undefined
        }
        confirmLabel="비공개로 바꾸기"
        loading={contact.isPending}
      />

      <Modal
        open={dialog?.kind === 'stop'}
        onClose={() => setDialog(null)}
        title="요청을 중단할까요?"
        description="중단하면 중개사무소에 더 이상 보이지 않고, 되돌릴 수 없어요."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDialog(null)}>
              계속 받기
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={stop.isPending}
              onClick={() => stop.mutate(stopKind)}
            >
              {stopKind === 'close' ? '요청 종료' : '요청 취소'}
            </Button>
          </>
        }
      >
        <fieldset className={styles.choice} style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr-only">중단 사유</legend>
          <label className={styles.choiceOpt}>
            <input
              type="radio"
              name="stop-kind"
              checked={stopKind === 'close'}
              onChange={() => setStopKind('close')}
            />
            <span>
              <b>거래를 마쳤거나 중개사를 정했어요</b>
              요청을 종료 상태로 보관해요.
            </span>
          </label>
          <label className={styles.choiceOpt}>
            <input
              type="radio"
              name="stop-kind"
              checked={stopKind === 'cancel'}
              onChange={() => setStopKind('cancel')}
            />
            <span>
              <b>요청을 취소할게요</b>
              계획이 바뀌었거나 잘못 등록했을 때 선택해 주세요.
            </span>
          </label>
        </fieldset>
      </Modal>
    </div>
  );
}
