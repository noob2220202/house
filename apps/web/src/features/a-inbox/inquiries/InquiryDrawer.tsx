'use client';
import {
  Button,
  Callout,
  Drawer,
  EmptyState,
  ErrorState,
  Icon,
  LoadingRegion,
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
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import {
  fetchInquiry,
  inboxKeys,
  replyToInquiry,
  updateInquiry,
  type InquiryPatch,
} from '../api/queries';
import type { Inquiry, InquiryStatus } from '../api/schemas';
import {
  INQUIRY_CHANNEL_META,
  INQUIRY_MEMO_MAX,
  INQUIRY_REPLY_MAX,
  INQUIRY_STATUS_LABEL,
  INQUIRY_STATUS_TONE,
  inquiryCustomer,
  inquiryPreview,
  isInquiryUnread,
} from '../lib/inquiry';
import { ListingMini } from '../ui/ListingMini';
import styles from './Inquiries.module.css';

const detailKey = (id: string) => [...inboxKeys.inquiries, 'detail', id] as const;

interface DetailProps {
  inquiry: Inquiry;
  onChange: (next: Inquiry) => void;
}

function InquiryDetail({ inquiry: i, onChange }: DetailProps) {
  const { toast } = useToast();
  const [memo, setMemo] = useState(i.memo ?? '');
  const [reply, setReply] = useState('');
  const [replyError, setReplyError] = useState<string>();
  const meta = INQUIRY_CHANNEL_META[i.channel];

  const patch = useMutation({
    mutationFn: (body: InquiryPatch) => updateInquiry(i.id, body),
    onSuccess: (next, body) => {
      onChange(next);
      if (body.memo !== undefined) toast('메모를 저장했어요.');
      else if (body.status) toast(`‘${INQUIRY_STATUS_LABEL[body.status]}’(으)로 바꿨어요.`);
    },
    onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
  });
  const send = useMutation({
    mutationFn: (message: string) => replyToInquiry(i.id, message),
    onSuccess: (next) => {
      onChange(next);
      setReply('');
      toast('답변을 보냈어요.');
    },
    onError: (e) => {
      const field = e instanceof ApiError && e.isValidation ? e.fieldErrors().message : undefined;
      if (field) setReplyError(field);
      else toast({ message: errorMessage(e), tone: 'error' });
    },
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
            {meta.label} · {formatDateTime(i.createdAt)}
          </span>
        </p>
        <StatusPill tone={INQUIRY_STATUS_TONE[i.status]}>
          {INQUIRY_STATUS_LABEL[i.status]}
        </StatusPill>
      </div>

      <section className={styles.block} aria-label="문의한 매물">
        <h3 className={styles.blockTitle}>문의한 매물</h3>
        {i.listing ? (
          <Link
            href={ROUTES.listing(i.listing.id)}
            target="_blank"
            rel="noopener"
            className={styles.listing}
          >
            <ListingMini listing={i.listing} />
            <span className="sr-only"> (새 창에서 열기)</span>
          </Link>
        ) : (
          <p className={styles.muted}>특정 매물이 아니라 사무소 페이지에서 들어온 문의예요.</p>
        )}
      </section>

      <section className={styles.block} aria-label="문의 내용">
        <h3 className={styles.blockTitle}>문의 내용</h3>
        {i.message ? (
          <div className={styles.thread}>
            <p className={styles.bubble}>{i.message}</p>
            {i.replies.map((r) => (
              <div key={r.id} className={styles.replyWrap}>
                <p className={cx(styles.bubble, styles.bubbleMine)}>{r.message}</p>
                <span className={styles.replyMeta}>
                  {[r.memberName, formatDateTime(r.createdAt)].filter(Boolean).join(' · ')}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.action}>{inquiryPreview(i)}</p>
        )}
        {i.canReply ? (
          <div className={styles.reply}>
            <Textarea
              label="답변"
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
            { value: 'NEW', label: INQUIRY_STATUS_LABEL.NEW },
            { value: 'IN_PROGRESS', label: INQUIRY_STATUS_LABEL.IN_PROGRESS },
            { value: 'DONE', label: INQUIRY_STATUS_LABEL.DONE },
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
    </div>
  );
}

export interface InquiryDrawerProps {
  /** Inquiry to show; null closes the drawer. */
  id: string | null;
  /** The row from the list (shown at once while the detail request runs). */
  seed?: Inquiry;
  onClose: () => void;
}

/** Side panel with one inquiry: listing, message / contact action, reply, status and memo. */
export function InquiryDrawer({ id, seed, onClose }: InquiryDrawerProps) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: detailKey(id ?? ''),
    queryFn: ({ signal }) => fetchInquiry(id ?? '', signal),
    enabled: !!id,
    initialData: seed,
    // The list row is good enough to render; refresh it in the background.
    initialDataUpdatedAt: 0,
  });
  const inquiry = id ? query.data : undefined;

  const onChange = (next: Inquiry) => {
    queryClient.setQueryData(detailKey(next.id), next);
    void queryClient.invalidateQueries({ queryKey: [...inboxKeys.inquiries, 'list'] });
    void queryClient.invalidateQueries({ queryKey: inboxKeys.inquirySummary });
    void queryClient.invalidateQueries({ queryKey: inboxKeys.dashboard });
  };

  return (
    <Drawer open={!!id} onClose={onClose} title="문의 상세" width={480}>
      {inquiry ? (
        <InquiryDetail key={inquiry.id} inquiry={inquiry} onChange={onChange} />
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
