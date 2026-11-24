'use client';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingRegion,
  Panel,
  SegmentedControl,
  Skeleton,
  StatTile,
  cx,
  useToast,
} from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { ConsolePage, ConsolePageHeader } from '@/features/a-agency/shell';
import {
  useMarkNotificationsRead,
  useNotificationFeed,
  useUnreadNotificationCount,
  type NotificationFilter,
} from '@/features/w-me/api';
import {
  isAgencyNotification,
  isUnread,
  notificationMeta,
} from '@/features/w-me/lib/notifications';
import type { Notification } from '@/features/w-me/schemas';
import { errorMessage } from '@/lib/api';
import { formatCount, formatRelativeTime } from '@/lib/format';
import { fetchInboxCounts, inboxKeys, type InboxCounts } from '../api/queries';
import { agentNotificationHref } from '../lib/notifications';
import { INBOX_ROUTES } from '../routes';
import ui from '../ui/inbox.module.css';
import styles from './Notifications.module.css';

/** Counters of the inbox, resolved on the server so the tiles paint with the page. */
export type InboxSummary = InboxCounts;

/** The console shows the agency audience of the feed (B5 `scope=agency`). */
const SCOPE = 'agency' as const;

interface RowProps {
  notification: Notification;
  onRead: (id: string) => void;
}

/**
 * One notification of the console feed. A row with a destination is a link (opening it marks it
 * read); an unread row without one is a button that marks it read; otherwise plain text.
 */
export function AgentNotificationRow({ notification: n, onRead }: RowProps) {
  const meta = notificationMeta(n.type);
  const href = agentNotificationHref(n);
  const unread = isUnread(n);
  const markRead = () => {
    if (unread) onRead(n.id);
  };
  const content = (
    <>
      <span className={cx(styles.icon, styles[meta.tone])}>
        <Icon name={meta.icon} size={20} />
      </span>
      <span className={styles.main}>
        <span className={styles.cat}>
          {unread && <span className="sr-only">읽지 않음, </span>}
          <span className={styles.catLabel}>{meta.label}</span>
          <time dateTime={n.createdAt}>{formatRelativeTime(n.createdAt)}</time>
        </span>
        <span className={styles.title}>{n.title}</span>
        {n.body && <span className={styles.body}>{n.body}</span>}
      </span>
      {unread ? (
        <span className={styles.dot} aria-hidden="true" />
      ) : (
        href && <Icon name="chevron-right" size={18} className={styles.chev} />
      )}
    </>
  );
  const className = cx(styles.row, unread && styles.unread);
  if (href)
    return (
      <Link href={href} className={className} onClick={markRead}>
        {content}
      </Link>
    );
  if (unread)
    return (
      <button type="button" className={className} onClick={markRead}>
        {content}
      </button>
    );
  return <div className={className}>{content}</div>;
}

function SummaryTiles({ initial }: { initial: InboxSummary }) {
  // Server values first; the client keeps them fresh (same cache as the list pages).
  const requests = useQuery({
    queryKey: inboxKeys.requestSummary,
    queryFn: ({ signal }) => fetchInboxCounts(signal),
    staleTime: 30_000,
  });
  const counts = requests.data;
  const tiles = [
    {
      href: `${INBOX_ROUTES.requests}?stage=new`,
      label: '제안 전 새 요청',
      value: counts?.newRequests ?? initial.newRequests,
      icon: 'home-up' as const,
      tone: 'brand' as const,
      detail: '먼저 제안할수록 선택받기 쉬워요',
    },
    {
      href: `${INBOX_ROUTES.requests}?stage=proposed`,
      label: '응답 대기 중인 제안',
      value: counts?.waitingProposals ?? initial.waitingProposals,
      icon: 'clock' as const,
      tone: 'neutral' as const,
      detail: '요청자가 검토하고 있어요',
    },
  ];
  return (
    <div className={styles.tiles}>
      {tiles.map((t) => (
        <Link key={t.href} href={t.href} className={styles.tileLink}>
          <StatTile
            className={styles.tile}
            label={t.label}
            value={t.value === null || t.value === undefined ? '–' : formatCount(t.value)}
            unit="건"
            icon={<Icon name={t.icon} size={18} />}
            iconTone={t.tone}
            detail={t.detail}
          />
        </Link>
      ))}
    </div>
  );
}

export interface AgentNotificationsViewProps {
  summary: InboxSummary;
}

/** /agent/notifications — the member's notification feed with console deep links. */
export function AgentNotificationsView({ summary }: AgentNotificationsViewProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const feed = useNotificationFeed(filter, SCOPE);
  const unread = useUnreadNotificationCount(SCOPE);
  const markRead = useMarkNotificationsRead(SCOPE);

  // The server filters by scope; the row check keeps personal rows out should it not.
  const items = (feed.data?.pages.flatMap((p) => p.items) ?? []).filter(isAgencyNotification);
  const unreadCount = unread.data ?? feed.data?.pages[0]?.unreadCount ?? 0;
  const markAll = () =>
    markRead.mutate(
      { all: true },
      {
        onSuccess: () => toast('알림을 모두 읽음으로 표시했어요.'),
        onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
      },
    );

  return (
    <ConsolePage width="narrow">
      <ConsolePageHeader
        eyebrow="고객"
        title="알림"
        description="새 요청, 제안 수락, 연락처 공개, 광고기간 만료와 공동중개 요청 소식을 모아서 보여 드려요."
        actions={
          <Button
            variant="secondary"
            size="sm"
            iconLeft={<Icon name="check" size={16} />}
            disabled={unreadCount === 0}
            loading={
              markRead.isPending && markRead.variables !== undefined && 'all' in markRead.variables
            }
            onClick={markAll}
          >
            모두 읽음
          </Button>
        }
      />

      <SummaryTiles initial={summary} />

      <Panel flush>
        <div className={ui.toolbar}>
          <SegmentedControl
            label="알림 필터"
            size="sm"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: '전체' },
              { value: 'unread', label: unreadCount > 0 ? `안 읽음 ${unreadCount}` : '안 읽음' },
            ]}
          />
        </div>
        {feed.isPending ? (
          <LoadingRegion label="알림을 불러오는 중">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={ui.skeletonRow}>
                <Skeleton width={44} height={44} radius={12} />
                <span className={ui.skeletonText}>
                  <Skeleton width={120} height={12} />
                  <Skeleton width="70%" height={16} />
                  <Skeleton width="90%" height={14} />
                </span>
              </div>
            ))}
          </LoadingRegion>
        ) : feed.isError ? (
          <ErrorState
            title="알림을 불러오지 못했어요"
            description={errorMessage(feed.error)}
            onRetry={() => void feed.refetch()}
          />
        ) : items.length === 0 ? (
          filter === 'unread' ? (
            <EmptyState
              icon="check-circle"
              title="읽지 않은 알림이 없어요"
              description="새 요청이나 문의가 오면 여기에서 먼저 알려 드릴게요."
              action={
                <Button variant="soft" size="sm" onClick={() => setFilter('all')}>
                  전체 알림 보기
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon="bell"
              title="받은 알림이 없어요"
              description="내놓기·구하기 요청이 도착하거나 제안이 수락되면 알려 드려요."
            />
          )
        ) : (
          <ul className={styles.list} aria-label="알림 목록">
            {items.map((n) => (
              <li key={n.id}>
                <AgentNotificationRow
                  notification={n}
                  onRead={(id) => markRead.mutate({ ids: [id] })}
                />
              </li>
            ))}
          </ul>
        )}
        {feed.hasNextPage && (
          <div className={ui.pager}>
            <Button
              variant="secondary"
              loading={feed.isFetchingNextPage}
              onClick={() => void feed.fetchNextPage()}
            >
              이전 알림 더 보기
            </Button>
          </div>
        )}
      </Panel>
      {!feed.hasNextPage && items.length > 0 && (
        <p className={styles.end}>마지막 알림까지 모두 확인했어요.</p>
      )}
    </ConsolePage>
  );
}
