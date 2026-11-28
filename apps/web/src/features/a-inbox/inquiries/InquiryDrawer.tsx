'use client';
import {
  INQUIRY_SOURCE_LABEL,
  INQUIRY_STATUS_LABEL,
  InquiriesErrorCode,
  InquiryAuthor,
  InquiryStatus,
} from '@house/shared';
import {
  Button,
  Callout,
  Drawer,
  EmptyState,
  ErrorState,
  Icon,
  LoadingRegion,
  Modal,
  RadioGroup,
  SegmentedControl,
  Skeleton,
  StatusPill,
  Textarea,
  cx,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ROUTES } from '@/config/nav';
import { telHref } from '@/features/w-inquiry/lib';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  deleteInquiry,
  fetchInquiry,
  inboxKeys,
  replyToInquiry,
  updateInquiry,
  type InquiryPatch,
} from '../api/queries';
import type { AgencyInquiry, InboxListing } from '../api/schemas';
import {
  INQUIRY_CHANNEL_META,
  INQUIRY_MEMO_MAX,
  INQUIRY_REPLY_MAX,
  INQUIRY_STATUS_TONE,
  inquiryCustomer,
  inquiryPhone,
  inquiryPreview,
  isInquiryUnread,
  statusChangedMessage,
} from '../lib/inquiry';
import { ListingMini } from '../ui/ListingMini';
import styles from './Inquiries.module.css';

/** `InquiryListingRef` → the compact card the inbox already renders. */
function miniListing(l: NonNullable<AgencyInquiry['listing']>): InboxListing {
  return {
    id: l.id,
    title: l.title,
    assetType: l.assetType,
    dealType: l.dealType,
    price: l.dealType === 'PRESALE' ? (l.presalePrice ?? l.salePrice) : l.salePrice,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
    thumbUrl: l.coverPhotoUrl,
  };
}

const DELETE_REASONS = [
  { value: 'spam', label: '스팸·광고' },
  { value: 'prank', label: '장난 문의' },
  { value: 'duplicate', label: '중복 문의' },
  { value: 'cleanup', label: '처리 끝난 기록 정리' },
] as const;
type DeleteReason = (typeof DELETE_REASONS)[number]['value'];

function DeleteDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState<DeleteReason>('spam');
  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title="이 문의를 삭제할까요?"
      description="문의함에서 지워지고 되돌릴 수 없어요. 고객에게는 따로 알리지 않아요."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            취소
          </Button>
          <Button
            variant="danger"
            loading={loading}
            onClick={() =>
              onConfirm(DELETE_REASONS.find((r) => r.value === reason)?.label ?? '정리')
            }
          >
            삭제
          </Button>
        </>
      }
    >
      <RadioGroup<DeleteReason>
        label="삭제 사유"
        name="inquiry-delete-reason"
        options={DELETE_REASONS}
        value={reason}
        onChange={setReason}
        direction="column"
        className={styles.reasons}
      />
    </Modal>
  );
}

interface DetailProps {
  inquiry: AgencyInquiry;
  /** Refresh the drawer, the list, the counters and the sidebar badges. */
  onChanged: (patch?: Partial<AgencyInquiry>) => void;
  onDeleted: () => void;
}

function InquiryDetail({ inquiry: i, onChanged, onDeleted }: DetailProps) {
  const { toast } = useToast();
  const [memo, setMemo] = useState(i.memo ?? '');
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState<string>();
  const [deleting, setDeleting] = useState(false);
  const meta = INQUIRY_CHANNEL_META[i.channel];
  const phone = inquiryPhone(i);
  const written = i.channel === 'MESSAGE';

  const patch = useMutation({
    mutationFn: (body: InquiryPatch) => updateInquiry(i.id, body),
    onSuccess: (_res, body) => {
      onChanged({
        ...(body.status ? { status: body.status } : {}),
        ...(body.memo !== undefined ? { memo: body.memo } : {}),
        ...(body.read ? { readAt: i.readAt ?? new Date().toISOString() } : {}),
      });
      if (body.memo !== undefined) toast('메모를 저장했어요.');
      else if (body.status) toast(statusChangedMessage(body.status));
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const send = useMutation({
    mutationFn: (message: string) => replyToInquiry(i.id, message),
    onSuccess: () => {
      onChanged();
      setReply('');
      toast('답변을 보냈어요. 고객에게 알림이 가요.');
    },
    onError: (e) => {
      const field = e instanceof ApiError && e.isValidation ? e.fieldErrors().message : undefined;
      if (field) setReplyError(field);
      else if (e instanceof ApiError && e.code === InquiriesErrorCode.INQUIRY_REPLY_NOT_ALLOWED) {
        setReplyError(e.message);
        onChanged();
      } else toast({ message: errorMessage(e), tone: 'error' });
    },
  });
  const remove = useMutation({
    mutationFn: (reason: string) => deleteInquiry(i.id, reason),
    onSuccess: () => {
      setDeleting(false);
      toast('문의를 삭제했어요.');
      onDeleted();
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });

  // Opening an unread inquiry marks it read (once per inquiry).
  const marked = useRef<string | null>(null);
  const { mutate: mutatePatch } = patch;
  useEffect(() => {
    if (isInquiryUnread(i) && marked.current !== i.id) {
      marked.current = i.id;
      mutatePatch({ read: true });
    }
  }, [i, mutatePatch]);

  const memoDirty = memo.trim() !== (i.memo ?? '');
  const submitReply = () => {
    const text = reply.trim();
    if (!text) return setReplyError('답변 내용을 입력해 주세요.');
    if (text.length > INQUIRY_REPLY_MAX)
      return setReplyError(
        `답변은 ${INQUIRY_REPLY_MAX.toLocaleString('ko-KR')}자까지 쓸 수 있어요.`,
      );
    setReplyError(undefined);
    send.mutate(text);
  };

  return (
    <div className={styles.detail}>
      <div className={styles.detailTop}>
        <span className={cx(styles.channel, styles[`ch${i.channel}`])}>
          <Icon name={meta.icon} size={20} />
        </span>
        <p className={styles.detailWho}>
          <b>{inquiryCustomer(i)}</b>
          <span>
            {meta.label} · {INQUIRY_SOURCE_LABEL[i.source]} · {formatDateTime(i.createdAt)}
          </span>
        </p>
        <StatusPill tone={INQUIRY_STATUS_TONE[i.status]}>
          {INQUIRY_STATUS_LABEL[i.status]}
        </StatusPill>
      </div>

      {written && (
        <section className={styles.block} aria-label="고객 정보">
          <h3 className={styles.blockTitle}>고객 정보</h3>
          <dl className={styles.customer}>
            <dt>이름</dt>
            <dd>
              {i.customerName ?? '—'}
              <span className={styles.siteBadge}>{i.isMember ? '회원' : '비회원'}</span>
            </dd>
            <dt>연락처</dt>
            <dd>
              {phone ? (
                <>
                  <span className="num">{phone}</span>
                  <a className={styles.tel} href={telHref(i.customerPhone ?? '')}>
                    <Icon name="phone" size={14} />
                    전화 걸기
                  </a>
                </>
              ) : (
                <span className={styles.muted}>남기지 않았어요</span>
              )}
            </dd>
          </dl>
        </section>
      )}

      <section className={styles.block} aria-label="문의한 매물">
        <h3 className={styles.blockTitle}>문의한 매물</h3>
        {i.listing ? (
          <Link
            href={ROUTES.listing(i.listing.id)}
            target="_blank"
            rel="noopener"
            className={styles.listing}
          >
            <ListingMini listing={miniListing(i.listing)} />
            <span className="sr-only"> (새 창에서 열기)</span>
          </Link>
        ) : (
          <p className={styles.muted}>
            특정 매물이 아니라 {i.source === 'SITE' ? '사무소 홈페이지' : '사무소 페이지'}에서
            들어온 문의예요.
          </p>
        )}
      </section>

      <section className={styles.block} aria-label="문의 내용">
        <h3 className={styles.blockTitle}>문의 내용</h3>
        {i.message ? (
          <ol className={styles.thread}>
            <li className={styles.bubbleWrap}>
              <p className={styles.bubble}>{i.message}</p>
              <span className={styles.bubbleMeta}>{formatDateTime(i.createdAt)}</span>
            </li>
            {i.messages.map((m) =>
              m.author === InquiryAuthor.AGENCY ? (
                <li key={m.id} className={styles.replyWrap}>
                  <p className={cx(styles.bubble, styles.bubbleMine)}>{m.body}</p>
                  <span className={styles.replyMeta}>
                    {[m.authorName, formatDateTime(m.createdAt)].filter(Boolean).join(' · ')}
                  </span>
                </li>
              ) : (
                <li key={m.id} className={styles.bubbleWrap}>
                  <p className={styles.bubble}>{m.body}</p>
                  <span className={styles.bubbleMeta}>
                    추가 문의 · {formatDateTime(m.createdAt)}
                  </span>
                </li>
              ),
            )}
          </ol>
        ) : (
          <p className={styles.action}>{inquiryPreview(i)}</p>
        )}
        {i.canReply ? (
          <div className={styles.reply}>
            <Textarea
              label="답변"
              help="회원 고객의 MY > 문의 내역으로 전달되고 알림이 가요."
              rows={3}
              placeholder="고객에게 보낼 답변을 적어 주세요."
              value={reply}
              onChange={(e) => {
                setReply(e.target.value);
                if (replyError) setReplyError(undefined);
              }}
              error={replyError}
              maxLength={INQUIRY_REPLY_MAX + 200}
            />
            <Button
              className={styles.replyBtn}
              size="sm"
              loading={send.isPending}
              disabled={reply.trim().length === 0}
              onClick={submitReply}
            >
              답변 보내기
            </Button>
          </div>
        ) : written ? (
          <Callout size="sm" tone="info" icon="phone">
            비회원 문의예요. 남긴 번호로 전화해 주세요. 통화 내용은 아래 메모에 남겨 두면 팀이 함께
            볼 수 있어요.
          </Callout>
        ) : (
          <Callout size="sm" tone="muted" icon="info">
            전화·문자·번호 복사는 고객이 사무소 번호로 직접 연락한 기록이에요. 고객 연락처는
            저장되지 않으니 통화 내용은 아래 메모에 남겨 두세요.
          </Callout>
        )}
      </section>

      <section className={styles.block} aria-label="처리 상태">
        <h3 className={styles.blockTitle}>처리 상태</h3>
        <SegmentedControl<InquiryStatus>
          label="처리 상태"
          value={i.status}
          onChange={(status) => status !== i.status && patch.mutate({ status })}
          options={[
            { value: InquiryStatus.NEW, label: INQUIRY_STATUS_LABEL.NEW },
            { value: InquiryStatus.IN_PROGRESS, label: INQUIRY_STATUS_LABEL.IN_PROGRESS },
            { value: InquiryStatus.DONE, label: INQUIRY_STATUS_LABEL.DONE },
          ]}
        />
      </section>

      <section className={styles.block}>
        <Textarea
          label="메모"
          help="우리 사무소 직원만 볼 수 있어요. 고객에게는 보이지 않아요."
          rows={4}
          placeholder="통화 내용, 방문 일정, 다음에 할 일을 적어 두세요."
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          maxLength={INQUIRY_MEMO_MAX}
        />
        <div className={styles.memoFoot}>
          <span className={styles.muted}>
            {i.handledByName ? `마지막 처리 ${i.handledByName}` : '아직 처리한 직원이 없어요'}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!memoDirty}
            loading={patch.isPending && patch.variables?.memo !== undefined}
            onClick={() => patch.mutate({ memo: memo.trim() || null })}
          >
            메모 저장
          </Button>
        </div>
      </section>

      <div className={styles.danger}>
        <span className={styles.muted}>
          스팸이나 장난 문의는 여기서 지울 수 있어요. 지운 문의는 목록에서 사라져요.
        </span>
        <Button
          variant="ghost"
          size="sm"
          iconLeft={<Icon name="trash" size={16} />}
          onClick={() => setDeleting(true)}
        >
          삭제
        </Button>
      </div>
      <DeleteDialog
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={(reason) => remove.mutate(reason)}
        loading={remove.isPending}
      />
    </div>
  );
}

export interface InquiryDrawerProps {
  /** Inquiry to show; null closes the drawer. */
  id: string | null;
  /** The row from the list (shown at once while the detail request runs). */
  seed?: AgencyInquiry;
  onClose: () => void;
}

/** Side panel with one inquiry: customer, listing, thread + reply, status, memo, 삭제. */
export function InquiryDrawer({ id, seed, onClose }: InquiryDrawerProps) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: inboxKeys.inquiry(id ?? ''),
    queryFn: ({ signal }) => fetchInquiry(id ?? '', signal),
    enabled: !!id,
    initialData: seed,
    // The list row is good enough to render; the thread comes with the detail request.
    initialDataUpdatedAt: 0,
  });
  const inquiry = id ? query.data : undefined;

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: [...inboxKeys.inquiries, 'list'] });
    void queryClient.invalidateQueries({ queryKey: inboxKeys.dashboard });
    void queryClient.invalidateQueries({ queryKey: inboxKeys.requestSummary });
  };
  const onChanged = (patch?: Partial<AgencyInquiry>) => {
    if (!id) return;
    if (patch) {
      queryClient.setQueryData<AgencyInquiry>(inboxKeys.inquiry(id), (old) =>
        old ? { ...old, ...patch } : old,
      );
    }
    void queryClient.invalidateQueries({ queryKey: inboxKeys.inquiry(id) });
    refreshLists();
  };
  const onDeleted = () => {
    if (id) queryClient.removeQueries({ queryKey: inboxKeys.inquiry(id) });
    refreshLists();
    onClose();
  };

  return (
    <Drawer open={!!id} onClose={onClose} title="문의 상세" width={480}>
      {inquiry ? (
        <InquiryDetail
          key={inquiry.id}
          inquiry={inquiry}
          onChanged={onChanged}
          onDeleted={onDeleted}
        />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.isNotFound ? (
          <EmptyState
            compact
            icon="chat"
            title="문의를 찾을 수 없어요"
            description="삭제됐거나 우리 사무소의 문의가 아니에요."
          />
        ) : (
          <ErrorState
            compact
            title="문의를 불러오지 못했어요"
            description={errorMessage(query.error)}
            onRetry={() => void query.refetch()}
          />
        )
      ) : (
        <LoadingRegion label="문의를 불러오는 중" className={styles.detail}>
          <Skeleton height={48} radius={12} />
          <Skeleton height={76} radius={12} />
          <Skeleton height={120} radius={12} />
          <Skeleton height={44} radius={12} />
        </LoadingRegion>
      )}
    </Drawer>
  );
}
