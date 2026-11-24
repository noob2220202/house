'use client';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Icon,
  ListingCardSkeleton,
  LoadingRegion,
  Skeleton,
  cx,
  type IconName,
} from '@house/ui';
import Link from 'next/link';
import { useRef } from 'react';
import { ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { isAgent, useSession, type SessionUser } from '@/lib/auth';
import { formatRelativeTime } from '@/lib/format';
import {
  useFavoriteComplexes,
  useFavoriteListings,
  useMarkNotificationsRead,
  useNotificationFeed,
  useRecentViews,
  useToggleFavoriteListing,
  useUnreadNotificationCount,
} from '../api';
import { useFavoriteRemoval } from '../hooks/useFavoriteRemoval';
import { useNow } from '../hooks/useNow';
import { useOverflowX } from '../hooks/useOverflowX';
import { useRemovalFocus } from '../hooks/useRemovalFocus';
import { listingFullName } from '../lib/listing-card';
import { unreadBadge } from '../lib/notifications';
import { roleCaption } from '../lib/profile';
import { PREVIEW_FAVORITES, PREVIEW_NOTIFICATIONS, PREVIEW_RECENT } from '../queries';
import { ME_NAV, ME_ROUTES } from '../routes';
import { LinkPending } from './LinkPending';
import { ListingMiniRow } from './ListingMiniRow';
import { MeListingCard } from './MeListingCard';
import { NotificationRow } from './NotificationRow';
import { RemovedNotice } from './RemovedNotice';
import { SectionHead } from './SectionHead';
import styles from './OverviewView.module.css';

interface Tile {
  key: string;
  label: string;
  href: string;
  icon: IconName;
  value: number | undefined;
  failed: boolean;
  unit: string;
  highlight?: boolean;
}

/** Mobile menu (the desktop sidebar carries the same links). */
function MobileMenu({ unreadText }: { unreadText?: string | null }) {
  return (
    <nav aria-label="마이페이지 메뉴" className={cx(styles.menu, 'only-sm')}>
      {ME_NAV.filter((item) => item.key !== 'overview').map((item) => (
        <Link key={item.key} href={item.href} className={styles.menuItem}>
          <span className={styles.menuIcon}>
            <Icon name={item.icon} size={20} />
          </span>
          <span className={styles.menuText}>
            <b>{item.label}</b>
            <span>{item.caption}</span>
          </span>
          {item.key === 'notifications' && unreadText && (
            <span className={styles.menuCount}>
              {unreadText}
              <span className="sr-only">개의 새 알림</span>
            </span>
          )}
          <LinkPending
            className={styles.chev}
            idle={<Icon name="chevron-right" size={18} className={styles.chev} />}
          />
        </Link>
      ))}
    </nav>
  );
}

function RecentRowsSkeleton() {
  return Array.from({ length: PREVIEW_RECENT }, (_, i) => (
    <div key={i} className={styles.rowSkeleton}>
      <Skeleton width={64} height={64} radius={12} />
      <span>
        <Skeleton width="50%" height={18} />
        <Skeleton width="80%" height={14} />
        <Skeleton width="60%" height={13} />
      </span>
    </div>
  ));
}

function NotificationRowsSkeleton() {
  return Array.from({ length: PREVIEW_NOTIFICATIONS }, (_, i) => (
    <div key={i} className={cx(styles.rowSkeleton, styles.rowSkeletonSm)}>
      <Skeleton width={36} height={36} radius={8} />
      <span>
        <Skeleton width="30%" height={12} />
        <Skeleton width="85%" height={15} />
      </span>
    </div>
  ));
}

export interface OverviewViewProps {
  user: SessionUser;
  /** Instant of the server render (ms) — keeps relative times identical through hydration. */
  now?: number;
}

export function OverviewView({ user: initialUser, now: serverNow }: OverviewViewProps) {
  const session = useSession();
  const user = session.user ?? initialUser;
  const agent = isAgent(user);
  const now = useNow(serverNow);

  const favorites = useFavoriteListings(1, PREVIEW_FAVORITES);
  const complexes = useFavoriteComplexes(1, 1);
  const recent = useRecentViews(1, PREVIEW_RECENT);
  const feed = useNotificationFeed('all');
  const unread = useUnreadNotificationCount();
  const toggleFavorite = useToggleFavoriteListing();
  const markRead = useMarkNotificationsRead();
  // The feed response carries the same counter and is part of the server-rendered data, so the
  // tile and the section count do not wait for the (post-mount) badge query.
  const unreadCount = unread.data ?? feed.data?.pages[0]?.unreadCount;

  const favoriteItems = favorites.data?.items.slice(0, PREVIEW_FAVORITES) ?? [];
  const favSectionRef = useRef<HTMLElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const [cardsRef, cardsScroll] = useOverflowX<HTMLUListElement>();
  // With no card left to take the focus: the newest "되돌리기", else the section's "전체 보기".
  const favFocus = useRemovalFocus(
    favoriteItems.map((l) => l.id),
    () => restoreRef.current ?? favSectionRef.current?.querySelector<HTMLElement>('a[href]'),
  );
  const removal = useFavoriteRemoval(toggleFavorite.mutateAsync, '매물을', (item, restored) =>
    favFocus.refocus(restored ? item.id : undefined),
  );

  const tiles: Tile[] = [
    {
      key: 'listings',
      label: '관심 매물',
      href: ME_ROUTES.favorites,
      icon: 'heart',
      value: favorites.data?.total,
      failed: favorites.isError,
      unit: '건',
    },
    {
      key: 'complexes',
      label: '관심 단지',
      href: ME_ROUTES.favoriteComplexes,
      icon: 'building',
      value: complexes.data?.total,
      failed: complexes.isError,
      unit: '곳',
    },
    {
      key: 'recent',
      label: '최근 본 매물',
      href: ME_ROUTES.recent,
      icon: 'eye',
      value: recent.data?.total,
      failed: recent.isError,
      unit: '건',
    },
    {
      key: 'unread',
      label: '새 알림',
      href: ME_ROUTES.notifications,
      icon: 'bell',
      value: unreadCount,
      failed: unread.isError || feed.isError,
      unit: '건',
      highlight: (unreadCount ?? 0) > 0,
    },
  ];

  const removeFavorite = (id: string, name: string) => {
    favFocus.willRemove(id);
    void removal.remove({ id, name });
  };

  const notifications = feed.data?.pages[0]?.items.slice(0, PREVIEW_NOTIFICATIONS) ?? [];
  const unreadText = unreadBadge(unreadCount);

  return (
    <div className={styles.view}>
      {/* Desktop greeting */}
      <header className={cx(styles.greeting, 'only-lg')}>
        <h1 className="t-h2">
          <span className={styles.nick}>{user.nickname}</span>님, 안녕하세요
        </h1>
        <p className="t-sm">담아 둔 매물과 단지, 새 소식을 한곳에서 확인하세요.</p>
      </header>

      {/* Mobile profile summary */}
      <Link href={ME_ROUTES.profile} className={cx(styles.profile, 'only-sm')}>
        <Avatar name={user.nickname} size={52} tone="soft" />
        <span className={styles.who}>
          <span className={styles.name}>
            <b>{user.nickname}</b>님
          </span>
          <span className={styles.sub}>
            <Badge tone={agent ? 'brand' : 'neutral'}>{roleCaption(user.role)}</Badge>
            {user.email && <span className={styles.email}>{user.email}</span>}
          </span>
        </span>
        <span className="sr-only">내 정보 수정</span>
        <Icon name="chevron-right" size={20} className={styles.chev} />
      </Link>

      <ul className={styles.tiles} aria-label="내 활동 요약">
        {tiles.map((t) => (
          <li key={t.key}>
            <Link href={t.href} className={cx(styles.tile, t.highlight && styles.tileOn)}>
              <span className={styles.tileIcon}>
                <Icon name={t.icon} size={20} />
              </span>
              <span className={styles.tileLabel}>{t.label}</span>
              <span className={styles.tileValue}>
                {t.value === undefined ? (
                  t.failed ? (
                    <span className={styles.tileDash} aria-label="불러오지 못함">
                      –
                    </span>
                  ) : (
                    <Skeleton width={36} height={28} />
                  )
                ) : (
                  <>
                    <b className="num">{t.value.toLocaleString('ko-KR')}</b>
                    <span className={styles.tileUnit}>{t.unit}</span>
                  </>
                )}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <MobileMenu unreadText={unreadText} />

      <section ref={favSectionRef} aria-labelledby="me-fav-h" className={styles.section}>
        <SectionHead
          id="me-fav-h"
          title="관심 매물"
          count={favorites.data?.total}
          href={ME_ROUTES.favorites}
        />
        <RemovedNotice
          items={removal.removed}
          objectPhrase="매물을"
          onRestore={(item) => void removal.restore(item)}
          onDismiss={removal.dismissRemoved}
          restoreRef={restoreRef}
        />
        {favorites.isPending ? (
          <LoadingRegion label="관심 매물 불러오는 중" className={styles.cards}>
            {Array.from({ length: PREVIEW_FAVORITES }, (_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </LoadingRegion>
        ) : favorites.isError ? (
          <div className={styles.box}>
            <ErrorState
              compact
              title="관심 매물을 불러오지 못했어요"
              description={errorMessage(favorites.error)}
              onRetry={() => void favorites.refetch()}
            />
          </div>
        ) : favorites.data.items.length === 0 ? (
          <div className={styles.box}>
            <EmptyState
              compact
              icon="heart"
              title="아직 담아 둔 매물이 없어요"
              description="마음에 드는 매물의 하트를 누르면 여기에 모여요."
              action={
                <Button href={ROUTES.map('apt')} linkAs={Link} size="sm" variant="soft">
                  지도에서 매물 찾기
                </Button>
              }
            />
          </div>
        ) : (
          // On mobile this list scrolls sideways: there (and only there) it is a tab stop of its
          // own, so it can be scrolled with the arrow keys.
          <ul
            ref={cardsRef}
            className={styles.cards}
            aria-label="관심 매물 미리보기"
            tabIndex={cardsScroll ? 0 : undefined}
          >
            {favoriteItems.map((listing) => (
              <li key={listing.id}>
                <MeListingCard
                  listing={listing}
                  favorite
                  favoriteRef={favFocus.register(listing.id)}
                  onFavoriteChange={() => removeFavorite(listing.id, listingFullName(listing))}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.split}>
        <section aria-labelledby="me-recent-h" className={styles.section}>
          <SectionHead
            id="me-recent-h"
            title="최근 본 매물"
            count={recent.data?.total}
            href={ME_ROUTES.recent}
          />
          <div className={styles.panel}>
            {recent.isPending ? (
              <LoadingRegion label="최근 본 매물 불러오는 중">
                <RecentRowsSkeleton />
              </LoadingRegion>
            ) : recent.isError ? (
              <ErrorState
                compact
                title="최근 본 매물을 불러오지 못했어요"
                description={errorMessage(recent.error)}
                onRetry={() => void recent.refetch()}
              />
            ) : recent.data.items.filter((v) => v.listing).length === 0 ? (
              <EmptyState
                compact
                icon="eye"
                title="최근 본 매물이 없어요"
                description="매물을 살펴보면 여기에 차례로 쌓여요."
              />
            ) : (
              <ul className={styles.rows}>
                {recent.data.items.slice(0, PREVIEW_RECENT).map((view) =>
                  view.listing ? (
                    <li key={view.targetId}>
                      <ListingMiniRow
                        listing={view.listing}
                        trailing={formatRelativeTime(view.viewedAt, now)}
                      />
                    </li>
                  ) : null,
                )}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="me-noti-h" className={styles.section}>
          <SectionHead
            id="me-noti-h"
            title="알림"
            count={unreadCount && unreadCount > 0 ? unreadCount : undefined}
            href={ME_ROUTES.notifications}
          />
          <div className={styles.panel}>
            {feed.isPending ? (
              <LoadingRegion label="알림 불러오는 중">
                <NotificationRowsSkeleton />
              </LoadingRegion>
            ) : feed.isError ? (
              <ErrorState
                compact
                title="알림을 불러오지 못했어요"
                description={errorMessage(feed.error)}
                onRetry={() => void feed.refetch()}
              />
            ) : notifications.length === 0 ? (
              <EmptyState
                compact
                icon="bell"
                title="받은 알림이 없어요"
                description="제안이 도착하거나 신고가 처리되면 알려 드려요."
              />
            ) : (
              <ul className={styles.rows}>
                {notifications.map((n) => (
                  <li key={n.id}>
                    <NotificationRow
                      notification={n}
                      compact
                      now={now}
                      onRead={(id) => markRead.mutate({ ids: [id] })}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Mobile-only account links (desktop: sidebar footer) */}
      <div className={cx(styles.account, 'only-sm')}>
        <Link href={agent ? ROUTES.agent : ROUTES.agentApply} className={styles.accountLink}>
          <Icon name="store" size={18} />
          {agent ? '중개사 콘솔' : '중개사 회원 가입'}
        </Link>
        <Link href={ROUTES.support} className={styles.accountLink}>
          <Icon name="info" size={18} />
          고객센터
        </Link>
        <button type="button" className={styles.accountLink} onClick={() => void session.logout()}>
          <Icon name="logout" size={18} />
          로그아웃
        </button>
      </div>
    </div>
  );
}
