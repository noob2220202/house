'use client';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  LoadingRegion,
  SegmentedControl,
  Skeleton,
  useToast,
} from '@house/ui';
import { useRef, useState } from 'react';
import { errorMessage } from '@/lib/api';
import {
  useMarkNotificationsRead,
  useNotificationFeed,
  useUnreadNotificationCount,
  type NotificationFilter,
} from '../api';
import { useNow } from '../hooks/useNow';
import { useRemovalFocus } from '../hooks/useRemovalFocus';
import { NotificationRow } from './NotificationRow';
import { SoftButton } from './SoftButton';
import styles from './NotificationsView.module.css';

function NotificationsSkeleton() {
  return (
    <div className={styles.panel}>
      <LoadingRegion label="알림 불러오는 중">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className={styles.skeleton}>
            <Skeleton width={44} height={44} radius={12} />
            <span>
              <Skeleton width={120} height={12} />
              <Skeleton width="70%" height={16} />
              <Skeleton width="90%" height={14} />
            </span>
          </div>
        ))}
      </LoadingRegion>
    </div>
  );
}

export interface NotificationsViewProps {
  /** Instant of the server render (ms) — keeps relative times identical through hydration. */
  now?: number;
}

/** 알림 센터: in-app notifications, newest first, with read state and "모두 읽음". */
export function NotificationsView({ now: serverNow }: NotificationsViewProps) {
  const { toast } = useToast();
  const now = useNow(serverNow);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const feed = useNotificationFeed(filter);
  const unread = useUnreadNotificationCount();
  const markRead = useMarkNotificationsRead();

  const items = feed.data?.pages.flatMap((p) => p.items) ?? [];
  const unreadCount = unread.data ?? feed.data?.pages[0]?.unreadCount ?? 0;

  // Under "안 읽음" a row leaves the list the moment it is read: hand its focus to a neighbour, or
  // to the empty state's action when it was the last one.
  const toolbarRef = useRef<HTMLDivElement>(null);
  const showAllRef = useRef<HTMLButtonElement>(null);
  const rowFocus = useRemovalFocus(
    items.map((n) => n.id),
    () => showAllRef.current,
  );
  // "전체 알림 보기" unmounts with the empty state: continue from the filter it just switched.
  const showAll = () => {
    toolbarRef.current?.querySelector<HTMLElement>('[data-value="all"]')?.focus();
    setFilter('all');
  };
  const readOne = (id: string) => {
    if (filter === 'unread') rowFocus.willRemove(id);
    markRead.mutate({ ids: [id] });
  };

  const markingAll =
    markRead.isPending && markRead.variables !== undefined && 'all' in markRead.variables;
  const markAll = () =>
    markRead.mutate(
      { all: true },
      {
        onSuccess: () => toast('알림을 모두 읽음으로 표시했어요.'),
        onError: (e) => toast({ message: errorMessage(e), tone: 'error' }),
      },
    );

  return (
    <div className={styles.view}>
      <div ref={toolbarRef} className={styles.toolbar}>
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
        {/* Stays focusable when it switches itself off (nothing left to mark). */}
        <SoftButton
          variant="secondary"
          size="sm"
          iconLeft={<Icon name="check" size={16} />}
          unavailable={unreadCount === 0}
          busy={markingAll}
          onClick={markAll}
        >
          모두 읽음
        </SoftButton>
      </div>

      {feed.isPending ? (
        <NotificationsSkeleton />
      ) : (
        <div className={styles.panel}>
          {feed.isError ? (
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
                description="새 소식이 오면 여기에서 먼저 알려 드릴게요."
                action={
                  <Button ref={showAllRef} variant="soft" size="sm" onClick={showAll}>
                    전체 알림 보기
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon="bell"
                title="받은 알림이 없어요"
                description="내놓기·구하기 요청에 제안이 도착하거나 신고가 처리되면 알려 드려요."
              />
            )
          ) : (
            <ul className={styles.list} aria-label="알림 목록">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationRow
                    notification={n}
                    now={now}
                    rowRef={rowFocus.register(n.id)}
                    onRead={readOne}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {feed.hasNextPage && (
        <Button
          className={styles.more}
          variant="secondary"
          loading={feed.isFetchingNextPage}
          onClick={() => void feed.fetchNextPage()}
        >
          이전 알림 더 보기
        </Button>
      )}
      {!feed.hasNextPage && items.length > 0 && (
        <p className={styles.end}>마지막 알림까지 모두 확인했어요.</p>
      )}
    </div>
  );
}
