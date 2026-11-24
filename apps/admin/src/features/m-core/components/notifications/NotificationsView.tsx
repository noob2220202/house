'use client';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingRegion,
  SegmentedControl,
  Skeleton,
  cx,
  useToast,
} from '@house/ui';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { AdminPageHeader } from '@/components/shell';
import { errorMessage } from '@/lib/api';
import { formatCount, formatRelativeTime } from '@/lib/format';
import {
  coreKeys,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AdminNotification,
  type AdminNotificationPage,
  type DashboardSummary,
} from '../../api';
import {
  NOTIFICATION_KIND_META,
  groupNotifications,
  safeNotificationLink,
} from '../../lib/notifications';
import styles from '../core.module.css';

const FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'unread', label: '안 읽음' },
] as const;
type Filter = (typeof FILTERS)[number]['value'];

type Feed = InfiniteData<AdminNotificationPage, string | undefined>;

function FeedSkeleton() {
  return (
    <LoadingRegion label="알림을 불러오는 중">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={styles.skRow}>
          <Skeleton width={36} height={36} radius={8} />
          <div className={styles.skCol}>
            <Skeleton width={`${52 - (i % 3) * 8}%`} height={14} />
            <Skeleton width={`${74 - (i % 2) * 16}%`} height={12} />
          </div>
          <Skeleton width={48} height={12} />
        </div>
      ))}
    </LoadingRegion>
  );
}

/** Back-office notification centre (bell): cursor feed, unread filter, mark as read. */
export function NotificationsView() {
  const [filter, setFilter] = useState<Filter>('all');
  const unreadOnly = filter === 'unread';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const feed = useInfiniteQuery({
    queryKey: coreKeys.notifications(unreadOnly),
    queryFn: ({ pageParam, signal }) =>
      fetchNotifications({ cursor: pageParam, unreadOnly }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 30_000,
  });

  /** Reflect a new unread count in the bell badge without waiting for the next poll. */
  const syncBell = (unread: number) => {
    queryClient.setQueryData<DashboardSummary>(coreKeys.summary(), (prev) =>
      prev ? { ...prev, notificationsUnread: unread } : prev,
    );
  };
  const patchFeeds = (patch: (n: AdminNotification) => AdminNotification, unread: number) => {
    queryClient.setQueriesData<Feed>({ queryKey: ['admin-notifications'] }, (prev) =>
      prev
        ? {
            ...prev,
            pages: prev.pages.map((p) => ({
              ...p,
              unreadCount: unread,
              items: p.items.map(patch),
            })),
          }
        : prev,
    );
  };

  const pages = feed.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items);
  // Until the feed arrives, show the same number as the bell (shell summary) instead of a wrong 0.
  const unreadCount =
    pages[0]?.unreadCount ??
    queryClient.getQueryData<DashboardSummary>(coreKeys.summary())?.notificationsUnread ??
    0;
  const now = new Date(feed.dataUpdatedAt || Date.now());

  const readOne = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onMutate: (id) => {
      const stamp = new Date().toISOString();
      const next = Math.max(0, unreadCount - 1);
      patchFeeds((n) => (n.id === id && !n.readAt ? { ...n, readAt: stamp } : n), next);
      syncBell(next);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] }),
  });

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      const stamp = new Date().toISOString();
      patchFeeds((n) => (n.readAt ? n : { ...n, readAt: stamp }), 0);
      syncBell(0);
      toast('알림을 모두 읽음으로 표시했어요');
      void queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (error) => toast({ message: errorMessage(error), tone: 'error' }),
  });

  const markRead = (n: AdminNotification) => {
    if (!n.readAt) readOne.mutate(n.id);
  };

  const groups = groupNotifications(items, now);

  return (
    <div className={cx(styles.page, styles.narrow)}>
      <AdminPageHeader title="알림" crumb={['관리자 알림']} />
      <div className={styles.toolbar}>
        <SegmentedControl
          label="알림 필터"
          size="sm"
          options={FILTERS}
          value={filter}
          onChange={setFilter}
        />
        <div className={styles.rowBetween}>
          <p className={styles.summary} role="status">
            안 읽은 알림 <b>{formatCount(unreadCount)}건</b>
          </p>
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Icon name="check" size={16} />}
            disabled={unreadCount === 0}
            loading={readAll.isPending}
            onClick={() => readAll.mutate()}
          >
            모두 읽음
          </Button>
        </div>
      </div>

      <section className={styles.panel} aria-label="알림 목록">
        {feed.isPending ? (
          <FeedSkeleton />
        ) : feed.isError ? (
          <ErrorState
            compact
            title="알림을 불러오지 못했어요"
            description={errorMessage(feed.error)}
            onRetry={() => void feed.refetch()}
          />
        ) : items.length === 0 ? (
          <EmptyState
            compact
            icon="bell"
            title={unreadOnly ? '안 읽은 알림이 없어요' : '아직 알림이 없어요'}
            description={
              unreadOnly
                ? '새 승인 요청이나 신고가 들어오면 이곳에 표시됩니다.'
                : '중개사 승인 요청, 신고, 광고 만료 같은 운영 알림이 이곳에 모입니다.'
            }
            action={
              unreadOnly ? (
                <Button variant="secondary" size="sm" onClick={() => setFilter('all')}>
                  전체 알림 보기
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {groups.map((group) => (
              <div key={group.key}>
                <h2 className={styles.groupT}>{group.label}</h2>
                <ul className={styles.notis}>
                  {group.items.map((n) => {
                    const meta = NOTIFICATION_KIND_META[n.kind];
                    const unread = !n.readAt;
                    const link = safeNotificationLink(n.link);
                    const body = (
                      <>
                        <span
                          className={cx(
                            styles.notiIcon,
                            meta.tone !== 'neutral' && styles[meta.tone],
                          )}
                          aria-hidden="true"
                        >
                          <Icon name={meta.icon} size={18} />
                        </span>
                        <span className={styles.notiT}>
                          <span className={styles.notiKind}>{meta.label}</span>
                          {n.title}
                        </span>
                        <span className={styles.notiTime}>
                          {formatRelativeTime(n.createdAt, now)}
                          {unread && (
                            <>
                              <span className={styles.dot} aria-hidden="true" />
                              <span className="sr-only">안 읽음</span>
                            </>
                          )}
                        </span>
                        {n.body && <span className={styles.notiB}>{n.body}</span>}
                      </>
                    );
                    const className = cx(styles.noti, unread && styles.unread);
                    return (
                      <li key={n.id}>
                        {/* A real link when the notification points somewhere (new tab, copy link,
                            announced as a link); otherwise a button that only marks it read. */}
                        {link ? (
                          <Link className={className} href={link} onClick={() => markRead(n)}>
                            {body}
                          </Link>
                        ) : (
                          <button type="button" className={className} onClick={() => markRead(n)}>
                            {body}
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {feed.hasNextPage && (
              <div className={styles.loadMore}>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={feed.isFetchingNextPage}
                  onClick={() => void feed.fetchNextPage()}
                >
                  이전 알림 더 보기
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
