'use client';
import {
  AgencyLogo,
  Button,
  EmptyState,
  ErrorState,
  Pagination,
  Skeleton,
  StatusPill,
  cx,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/nav';
import { ApiError, errorMessage } from '@/lib/api';
import { formatRelativeTime } from '@/lib/format';
import { fetchMyInquiries, inquiryKeys } from '../api';
import { INQUIRY_STATUS_TONE, MY_INQUIRY_STATUS_LABEL, inquiryListingText } from '../lib';
import { ME_INQUIRY_ROUTES } from '../routes';
import type { MyInquiryItem, MyInquiryPage } from '../schemas';
import styles from './me.module.css';

export function OfficeLogo({
  agency,
  size,
}: {
  agency: { id: string; name: string; logoUrl: string | null };
  size: number;
}) {
  return (
    <AgencyLogo
      name={agency.name}
      seed={agency.id}
      size={size}
      image={
        agency.logoUrl ? (
          <Image
            src={agency.logoUrl}
            alt=""
            fill
            sizes={`${size}px`}
            unoptimized={agency.logoUrl.startsWith('/mock-api/')}
          />
        ) : undefined
      }
    />
  );
}

function InquiryCard({ item }: { item: MyInquiryItem }) {
  const title = item.listing ? inquiryListingText(item.listing) : `${item.agency.name}에 보낸 문의`;
  return (
    <li className={cx(styles.card, item.hasUnreadReply && styles.cardUnread)}>
      <OfficeLogo agency={item.agency} size={48} />
      <div className={styles.body}>
        <p className={styles.office}>
          <b>{item.agency.name}</b>
        </p>
        <h2 className={styles.name}>
          <Link href={ME_INQUIRY_ROUTES.detail(item.id)}>{title}</Link>
        </h2>
        {item.preview && <p className={styles.preview}>{item.preview}</p>}
      </div>
      <div className={styles.side}>
        <StatusPill tone={INQUIRY_STATUS_TONE[item.status]}>
          {MY_INQUIRY_STATUS_LABEL[item.status]}
        </StatusPill>
        {item.hasUnreadReply && <span className={styles.newBadge}>새 답변</span>}
        <span className={styles.meta}>
          {item.replyCount > 0 ? `답변 ${item.replyCount} · ` : ''}
          {formatRelativeTime(item.lastMessageAt)}
        </span>
      </div>
    </li>
  );
}

export function MyInquiriesSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className={styles.list} role="status" aria-busy="true" aria-label="문의를 불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={styles.skCard} aria-hidden="true">
          <Skeleton width={48} height={48} radius={12} />
          <div className={styles.skLines}>
            <Skeleton width="30%" height={13} />
            <Skeleton width="65%" height={18} />
            <Skeleton width="90%" height={14} />
          </div>
        </div>
      ))}
    </div>
  );
}

export interface MyInquiriesViewProps {
  page: number;
  /** First paint from the server (null = the server fetch failed; the browser asks again). */
  initial: MyInquiryPage | null;
}

/**
 * MY > 문의 내역: written inquiries the member sent to offices, newest activity first, with the
 * office's answer state ("새 답변" until the thread is opened).
 */
export function MyInquiriesView({ page, initial }: MyInquiriesViewProps) {
  const router = useRouter();
  const query = useQuery({
    queryKey: inquiryKeys.myList(page),
    queryFn: ({ signal }) => fetchMyInquiries(page, signal),
    initialData: initial ?? undefined,
    // Coming back from a thread: its replies are read now, so the badges may have changed.
    refetchOnMount: 'always',
  });

  if (query.isPending) return <MyInquiriesSkeleton />;
  if (query.isError)
    return (
      <ErrorState
        title="문의 내역을 불러오지 못했어요"
        description={errorMessage(query.error)}
        onRetry={() => void query.refetch()}
        code={query.error instanceof ApiError ? query.error.requestId : undefined}
      />
    );
  const data = query.data;
  if (data.items.length === 0)
    return (
      <EmptyState
        icon="chat"
        title={page > 1 ? '이 페이지에는 문의가 없어요' : '아직 남긴 문의가 없어요'}
        description="매물이나 중개사무소 페이지에서 ‘문의하기’를 눌러 궁금한 점을 남겨 보세요. 답변이 오면 여기에서 볼 수 있어요."
        action={
          <Button
            variant="soft"
            href={page > 1 ? ME_INQUIRY_ROUTES.list : ROUTES.map()}
            linkAs={Link}
          >
            {page > 1 ? '첫 페이지로' : '매물 둘러보기'}
          </Button>
        }
      />
    );
  return (
    <>
      <ul className={styles.list}>
        {data.items.map((item) => (
          <InquiryCard key={item.id} item={item} />
        ))}
      </ul>
      {data.totalPages > 1 && (
        <div className={styles.pager}>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onChange={(next) =>
              router.push(
                next > 1 ? `${ME_INQUIRY_ROUTES.list}?page=${next}` : ME_INQUIRY_ROUTES.list,
              )
            }
          />
        </div>
      )}
    </>
  );
}
