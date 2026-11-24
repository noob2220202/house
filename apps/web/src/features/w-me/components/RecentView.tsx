'use client';
import {
  Button,
  EmptyState,
  ErrorState,
  ListingCardSkeleton,
  LoadingRegion,
  Pagination,
  useToast,
} from '@house/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { favoriteToast } from '@/lib/favorites/useFavorite';
import { toKstDateString } from '@/lib/format';
import { useRecentViews, useToggleFavoriteListing } from '../api';
import { useNow } from '../hooks/useNow';
import { parsePageParam } from '../lib/params';
import { groupRecentViews } from '../lib/recent';
import { RECENT_PAGE_SIZE } from '../queries';
import { ME_ROUTES } from '../routes';
import type { ListingSummary, RecentView as RecentViewItem } from '../schemas';
import { MeListingCard } from './MeListingCard';
import { ShallowPageLink } from './ShallowLink';
import styles from './RecentView.module.css';

export function recentHref(page = 1): string {
  return page > 1 ? `${ME_ROUTES.recent}?page=${page}` : ME_ROUTES.recent;
}

type ListingView = RecentViewItem & { listing: ListingSummary };

function RecentSkeleton() {
  return (
    <LoadingRegion label="최근 본 매물 불러오는 중" className={styles.grid}>
      {Array.from({ length: 6 }, (_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </LoadingRegion>
  );
}

export interface RecentViewProps {
  /** Instant of the server render (ms) — keeps the day buckets identical through hydration. */
  now?: number;
}

/**
 * 최근 본 매물, grouped by day (오늘 / 어제 / 이번 주 / 지난 기록). Hearts add or remove favourites.
 * The page number lives in the URL (`?page=`) and changes on the client.
 */
export function RecentView({ now: serverNow }: RecentViewProps) {
  const { toast } = useToast();
  const page = parsePageParam(useSearchParams().get('page') ?? undefined);
  const now = useNow(serverNow);
  const recent = useRecentViews(page, RECENT_PAGE_SIZE);
  const { mutateAsync } = useToggleFavoriteListing();

  // Buckets only move at (Seoul) midnight: key the memo by that day, not by the ticking clock.
  const today = toKstDateString(now);
  const groups = useMemo(() => {
    const views = (recent.data?.items ?? []).filter((v): v is ListingView => !!v.listing);
    return groupRecentViews(views, new Date(`${today}T12:00:00+09:00`));
  }, [recent.data, today]);

  // Awaited per call so every heart gets its own confirmation, also when several are toggled in a
  // row (callbacks passed to `mutate()` only run for the latest call).
  const onFavorite = async (listing: ListingSummary, next: boolean) => {
    try {
      await mutateAsync({ id: listing.id, favorite: next });
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' });
      return;
    }
    toast(favoriteToast('listings', next));
  };

  if (recent.isPending) return <RecentSkeleton />;
  if (recent.isError)
    return (
      <div className={styles.box}>
        <ErrorState
          title="최근 본 매물을 불러오지 못했어요"
          description={errorMessage(recent.error)}
          onRetry={() => void recent.refetch()}
        />
      </div>
    );
  if (groups.length === 0)
    return (
      <div className={styles.box}>
        <EmptyState
          icon="eye"
          title="최근 본 매물이 없어요"
          description="매물 상세를 열어 보면 여기에 차례로 쌓여요. 다시 찾지 않아도 바로 이어서 볼 수 있어요."
          action={
            <Button href={ROUTES.map('apt')} linkAs={Link}>
              지도에서 매물 찾기
            </Button>
          }
        />
      </div>
    );

  return (
    <div className={styles.view}>
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`recent-${group.key}`}>
          <h2 id={`recent-${group.key}`} className={styles.groupTitle}>
            {group.label}
            <span className="num">{group.items.length}</span>
          </h2>
          <ul className={styles.grid}>
            {group.items.map((view) => (
              <li key={view.targetId}>
                <MeListingCard
                  listing={view.listing}
                  favorite={!!view.listing.isFavorite}
                  onFavoriteChange={(next) => void onFavorite(view.listing, next)}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      {recent.data.totalPages > 1 && (
        <Pagination
          className={styles.pagination}
          page={page}
          totalPages={recent.data.totalPages}
          linkAs={ShallowPageLink}
          hrefFor={recentHref}
        />
      )}
    </div>
  );
}
