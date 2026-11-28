'use client';
import { DEAL_TYPE_LABEL, INQUIRY_LIMITS, InquiriesErrorCode, InquiryAuthor } from '@house/shared';
import {
  Button,
  Callout,
  ErrorState,
  Icon,
  PhotoPlaceholder,
  StatusPill,
  Textarea,
  cx,
  photoKindForAsset,
  useToast,
} from '@house/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ROUTES } from '@/config/nav';
import { meKeys } from '@/features/w-me/queries';
import { ApiError, errorMessage } from '@/lib/api';
import { formatDateTime, formatPhone } from '@/lib/format';
import { fetchMyInquiry, inquiryKeys, sendFollowUp } from '../api';
import {
  FOLLOW_UP_CLOSED_MESSAGE,
  INQUIRY_STATUS_TONE,
  MY_INQUIRY_STATUS_LABEL,
  canFollowUp,
  inquiryListingPrice,
  telHref,
} from '../lib';
import type { MyInquiry } from '../schemas';
import { OfficeLogo } from './MyInquiriesView';
import styles from './me.module.css';

export interface MyInquiryThreadViewProps {
  initial: MyInquiry;
}

/**
 * One inquiry under MY > 문의 내역: the office, the listing asked about, the thread (my texts on the
 * right, the office's answers on the left) and a box for a follow-up question.
 */
export function MyInquiryThreadView({ initial }: MyInquiryThreadViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: inquiryKeys.myDetail(initial.id),
    queryFn: ({ signal }) => fetchMyInquiry(initial.id, signal),
    initialData: initial,
    // An answer may arrive while the page is open in a tab.
    refetchOnWindowFocus: true,
  });
  const i = query.data;
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  // The API refused a follow-up (office no longer approved / thread erased) — 409.
  const [blocked, setBlocked] = useState(false);

  // Reading the thread marked the office's replies read: refresh the list badges and the bell.
  useEffect(() => {
    void queryClient.invalidateQueries({ queryKey: inquiryKeys.lists });
    void queryClient.invalidateQueries({ queryKey: meKeys.notifications });
  }, [queryClient]);

  const send = useMutation({
    mutationFn: (message: string) => sendFollowUp(i.id, message),
    onSuccess: () => {
      setText('');
      toast('추가 문의를 보냈어요.');
      void queryClient.invalidateQueries({ queryKey: inquiryKeys.mine });
    },
    onError: (e) => {
      // The API's message is worded for the office ("call the number they left"): say it for
      // the member, and close the box instead of letting them retry.
      if (e instanceof ApiError && e.code === InquiriesErrorCode.INQUIRY_REPLY_NOT_ALLOWED) {
        setBlocked(true);
        return;
      }
      const field = e instanceof ApiError && e.isValidation ? e.fieldErrors().message : undefined;
      if (field) setError(field);
      else toast({ message: errorMessage(e), tone: 'error' });
    },
  });

  const submit = () => {
    const body = text.trim();
    if (!body) return setError('내용을 입력해 주세요.');
    if (body.length > INQUIRY_LIMITS.REPLY_MAX)
      return setError(
        `내용은 ${INQUIRY_LIMITS.REPLY_MAX.toLocaleString('ko-KR')}자까지 쓸 수 있어요.`,
      );
    setError(undefined);
    send.mutate(body);
  };

  const answered = i.messages.some((m) => m.author === InquiryAuthor.AGENCY);
  const open = !blocked && canFollowUp(i);
  const l = i.listing;

  return (
    <div className={styles.thread}>
      <section className={styles.head} aria-label="문의한 중개사무소">
        <OfficeLogo agency={i.agency} size={52} />
        <div className={styles.headName}>
          <b>{i.agency.name}</b>
          <Link href={ROUTES.agency(i.agency.id)}>사무소 정보 보기</Link>
        </div>
        {i.agency.phone && (
          <a className={styles.call} href={telHref(i.agency.phone)}>
            <Icon name="phone" size={16} />
            <span className="num">{formatPhone(i.agency.phone)}</span>
          </a>
        )}
      </section>

      {l && (
        <Link href={ROUTES.listing(l.id)} className={styles.listing}>
          <span className={styles.thumb}>
            {l.coverPhotoUrl ? (
              <Image
                src={l.coverPhotoUrl}
                alt=""
                fill
                sizes="56px"
                unoptimized={l.coverPhotoUrl.startsWith('/mock-api/')}
              />
            ) : (
              <PhotoPlaceholder kind={photoKindForAsset(l.assetType)} />
            )}
          </span>
          <span className={styles.listingText}>
            <b>{l.title}</b>
            <span>
              {DEAL_TYPE_LABEL[l.dealType]} {inquiryListingPrice(l)}
            </span>
          </span>
          <Icon name="chevron-right" size={18} />
        </Link>
      )}

      <section aria-label="문의 내용">
        <p className={styles.contactLine}>
          <StatusPill tone={INQUIRY_STATUS_TONE[i.status]}>
            {MY_INQUIRY_STATUS_LABEL[i.status]}
          </StatusPill>
          {(i.name || i.phone) && (
            <span>
              남긴 연락처{' '}
              <span className="num">
                {[i.name, i.phone ? formatPhone(i.phone) : null].filter(Boolean).join(' · ')}
              </span>
            </span>
          )}
        </p>
        <ol className={styles.messages} aria-label="대화">
          <li className={cx(styles.msg, styles.msgMine)}>
            <p className={styles.bubble}>{i.message}</p>
            <span className={styles.msgMeta}>나 · {formatDateTime(i.createdAt)}</span>
          </li>
          {i.messages.map((m) => {
            const mine = m.author === InquiryAuthor.CUSTOMER;
            return (
              <li key={m.id} className={cx(styles.msg, mine && styles.msgMine)}>
                <p className={styles.bubble}>{m.body}</p>
                <span className={styles.msgMeta}>
                  {mine ? '나' : (m.authorName ?? i.agency.name)} · {formatDateTime(m.createdAt)}
                </span>
              </li>
            );
          })}
          {!answered && (
            <li className={styles.waiting}>중개사무소가 확인하고 답변하면 알림으로 알려 드려요.</li>
          )}
        </ol>
      </section>

      {!open ? (
        <section className={styles.compose} aria-label="추가 문의">
          <Callout tone="muted" icon="info" size="sm" live={blocked}>
            {FOLLOW_UP_CLOSED_MESSAGE}
            {i.agency.phone && (
              <>
                {' '}
                <a className="link num" href={telHref(i.agency.phone)}>
                  {formatPhone(i.agency.phone)}
                </a>
              </>
            )}
          </Callout>
          {/* What was typed stays readable (and copyable) after a refused send. */}
          {blocked && text.trim() && (
            <Textarea label="보내지 못한 내용" rows={3} value={text} readOnly />
          )}
        </section>
      ) : (
        <section className={styles.compose} aria-label="추가 문의">
          <Textarea
            label="추가 문의"
            rows={3}
            placeholder="더 궁금한 점이 있으면 이어서 남겨 주세요."
            value={text}
            error={error}
            maxLength={INQUIRY_LIMITS.REPLY_MAX + 200}
            onChange={(e) => {
              setText(e.target.value);
              if (error) setError(undefined);
            }}
          />
          <div className={styles.composeFoot}>
            <span className="num">
              {text.trim().length.toLocaleString('ko-KR')}/
              {INQUIRY_LIMITS.REPLY_MAX.toLocaleString('ko-KR')}
            </span>
            <Button size="sm" loading={send.isPending} disabled={!text.trim()} onClick={submit}>
              보내기
            </Button>
          </div>
        </section>
      )}

      {query.isError && query.isRefetchError && (
        <ErrorState
          compact
          title="새 답변을 확인하지 못했어요"
          description={errorMessage(query.error)}
          onRetry={() => void query.refetch()}
        />
      )}
    </div>
  );
}
