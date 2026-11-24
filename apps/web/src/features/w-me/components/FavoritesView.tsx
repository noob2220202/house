'use client';
import {
  Button,
  ComplexRow,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  ListingCardSkeleton,
  LoadingRegion,
  Pagination,
  Skeleton,
  Tabs,
  cx,
} from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, type Ref } from 'react';
import { favoriteLabel } from '@/lib/favorites/useFavorite';
import { ROUTES } from '@/config/nav';
import { errorMessage } from '@/lib/api';
import { formatDateShort, formatPerPyeong } from '@/lib/format';
import {
  useFavoriteComplexes,
  useFavoriteListings,
  useToggleFavoriteComplex,
  useToggleFavoriteListing,
} from '../api';
import { useFavoriteRemoval } from '../hooks/useFavoriteRemoval';
import { useRemovalFocus } from '../hooks/useRemovalFocus';
import {
  complexHeadlinePrice,
  complexListingTotal,
  complexMeta,
  listingFullName,
} from '../lib/listing-card';
import { parsePageParam } from '../lib/params';
import { FAVORITES_PAGE_SIZE } from '../queries';
import { ME_ROUTES } from '../routes';
import type { FavoriteComplex } from '../schemas';
import { MeListingCard } from './MeListingCard';
import { RemovedNotice } from './RemovedNotice';
import { ShallowLink, ShallowPageLink } from './ShallowLink';
import styles from './FavoritesView.module.css';

export type FavoritesTab = 'listings' | 'complexes';

/** Href of a favourites tab/page; the defaults (매물 tab, page 1) stay out of the URL. */
export function favoritesHref(tab: FavoritesTab, page = 1): string {
  const sp = new URLSearchParams();
  if (tab === 'complexes') sp.set('tab', 'complexes');
  if (page > 1) sp.set('page', String(page));
  const qs = sp.toString();
  return qs ? `${ME_ROUTES.favorites}?${qs}` : ME_ROUTES.favorites;
}

/**
 * Tab and page of the favourites screen. The URL is the source of truth (`?tab=complexes&page=2`);
 * tabs and pagination change it on the client (see <ShallowLink>), so reading it here — instead of
 * taking props from the server page — keeps the view in step without a server navigation.
 */
export function useFavoritesParams(): { tab: FavoritesTab; page: number } {
  const sp = useSearchParams();
  return {
    tab: sp.get('tab') === 'complexes' ? 'complexes' : 'listings',
    page: parsePageParam(sp.get('page') ?? undefined),
  };
}

const TAB_DESCRIPTION: Record<FavoritesTab, string> = {
  listings: '하트로 담아 둔 매물이에요. 거래가 끝난 매물은 ‘거래완료’로 표시돼요.',
  complexes: '하트로 담아 둔 단지의 시세와 매물 수를 한곳에서 확인하세요.',
};

/** Page description under the heading — follows the open tab. */
export function FavoritesDescription() {
  return TAB_DESCRIPTION[useFavoritesParams().tab];
}

const TAB_ITEMS = [
  { value: 'listings', label: '관심 매물' },
  { value: 'complexes', label: '관심 단지' },
] as const;

function ListingGridSkeleton() {
  return (
    <LoadingRegion label="관심 매물 불러오는 중" className={styles.grid}>
      {Array.from({ length: 6 }, (_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </LoadingRegion>
  );
}

function ComplexGridSkeleton() {
  return (
    <LoadingRegion label="관심 단지 불러오는 중" className={styles.complexGrid}>
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className={styles.complexSkeleton}>
          <Skeleton width={64} height={64} radius={12} />
          <span>
            <Skeleton width="55%" height={18} />
            <Skeleton width="75%" height={14} />
            <Skeleton width="45%" height={18} />
            <Skeleton width={176} height={44} radius={8} />
          </span>
        </div>
      ))}
    </LoadingRegion>
  );
}

/** 관심 매물 / 관심 단지 with URL-driven tabs and optimistic remove + undo. */
export function FavoritesView() {
  const { tab, page } = useFavoritesParams();
  const listings = useFavoriteListings(tab === 'listings' ? page : 1, FAVORITES_PAGE_SIZE);
  const complexes = useFavoriteComplexes(tab === 'complexes' ? page : 1, FAVORITES_PAGE_SIZE);
  const toggleListing = useToggleFavoriteListing();
  const toggleComplex = useToggleFavoriteComplex();

  const viewRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  // With no card left to take the focus: the newest "되돌리기", else the open tab.
  const focusFallback = () =>
    restoreRef.current ?? viewRef.current?.querySelector<HTMLElement>('[aria-current="page"]');
  const listingFocus = useRemovalFocus(listings.data?.items.map((l) => l.id) ?? [], focusFallback);
  const complexFocus = useRemovalFocus(complexes.data?.items.map((c) => c.id) ?? [], focusFallback);
  const listingRemoval = useFavoriteRemoval(toggleListing.mutateAsync, '매물을', (item, restored) =>
    listingFocus.refocus(restored ? item.id : undefined),
  );
  const complexRemoval = useFavoriteRemoval(toggleComplex.mutateAsync, '단지를', (item, restored) =>
    complexFocus.refocus(restored ? item.id : undefined),
  );

  const current = tab === 'listings' ? listings : complexes;
  const totalPages = current.data?.totalPages ?? 1;
  const isEmptyPage = current.data !== undefined && current.data.items.length === 0;
  // Removing the last card of the last page: step back instead of showing an empty page.
  useEffect(() => {
    if (isEmptyPage && page > 1 && !current.isFetching)
      window.history.replaceState(null, '', favoritesHref(tab, Math.min(page - 1, totalPages)));
  }, [isEmptyPage, page, totalPages, tab, current.isFetching]);

  const removeListing = (id: string, name: string) => {
    listingFocus.willRemove(id);
    void listingRemoval.remove({ id, name });
  };
  const removeComplex = (id: string, name: string) => {
    complexFocus.willRemove(id);
    void complexRemoval.remove({ id, name });
  };

  return (
    <div ref={viewRef} className={styles.view}>
      <Tabs
        label="관심 목록"
        linkAs={ShallowLink}
        value={tab}
        items={[
          { ...TAB_ITEMS[0], count: listings.data?.total, href: favoritesHref('listings') },
          { ...TAB_ITEMS[1], count: complexes.data?.total, href: favoritesHref('complexes') },
        ]}
      />

      <p className={styles.summary} aria-live="polite">
        {current.data ? (
          <>
            <span>
              전체 <b className="num">{current.data.total.toLocaleString('ko-KR')}</b>
              {tab === 'listings' ? '건' : '곳'}
            </span>
            <span className={styles.sort}>최근 담은 순</span>
          </>
        ) : (
          <span>&nbsp;</span>
        )}
      </p>

      {tab === 'listings' ? (
        <>
          <RemovedNotice
            items={listingRemoval.removed}
            objectPhrase="매물을"
            onRestore={(item) => void listingRemoval.restore(item)}
            onDismiss={listingRemoval.dismissRemoved}
            restoreRef={restoreRef}
          />
          {listings.isPending ? (
            <ListingGridSkeleton />
          ) : listings.isError ? (
            <div className={styles.box}>
              <ErrorState
                title="관심 매물을 불러오지 못했어요"
                description={errorMessage(listings.error)}
                onRetry={() => void listings.refetch()}
              />
            </div>
          ) : listings.data.items.length === 0 ? (
            <div className={styles.box}>
              <EmptyState
                icon="heart"
                title="아직 담아 둔 매물이 없어요"
                description="지도나 목록에서 마음에 드는 매물의 하트를 누르면 여기에 모여요. 거래가 끝난 매물도 표시해 드려요."
                action={
                  <Button href={ROUTES.map('apt')} linkAs={Link}>
                    지도에서 매물 찾기
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className={cx(styles.grid, listings.isPlaceholderData && styles.stale)}>
              {listings.data.items.map((listing, i) => (
                <li key={listing.id}>
                  <MeListingCard
                    listing={listing}
                    favorite
                    favoriteRef={listingFocus.register(listing.id)}
                    headingLevel={2}
                    priority={i < 3}
                    onFavoriteChange={() => removeListing(listing.id, listingFullName(listing))}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <RemovedNotice
            items={complexRemoval.removed}
            objectPhrase="단지를"
            onRestore={(item) => void complexRemoval.restore(item)}
            onDismiss={complexRemoval.dismissRemoved}
            restoreRef={restoreRef}
          />
          {complexes.isPending ? (
            <ComplexGridSkeleton />
          ) : complexes.isError ? (
            <div className={styles.box}>
              <ErrorState
                title="관심 단지를 불러오지 못했어요"
                description={errorMessage(complexes.error)}
                onRetry={() => void complexes.refetch()}
              />
            </div>
          ) : complexes.data.items.length === 0 ? (
            <div className={styles.box}>
              <EmptyState
                icon="building"
                title="아직 담아 둔 단지가 없어요"
                description="단지 정보에서 하트를 누르면 그 단지의 시세와 매물 수를 여기에서 한 번에 볼 수 있어요."
                action={
                  <Button href={ROUTES.map('apt')} linkAs={Link}>
                    아파트 단지 둘러보기
                  </Button>
                }
              />
            </div>
          ) : (
            <ul className={cx(styles.complexGrid, complexes.isPlaceholderData && styles.stale)}>
              {complexes.data.items.map((complex) => (
                <li key={complex.id}>
                  <FavoriteComplexCard
                    complex={complex}
                    removeRef={complexFocus.register(complex.id)}
                    onRemove={() => removeComplex(complex.id, complex.name)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {totalPages > 1 && (
        <Pagination
          className={styles.pagination}
          page={page}
          totalPages={totalPages}
          linkAs={ShallowPageLink}
          hrefFor={(p) => favoritesHref(tab, p)}
        />
      )}
    </div>
  );
}

function FavoriteComplexCard({
  complex,
  removeRef,
  onRemove,
}: {
  complex: FavoriteComplex;
  removeRef?: Ref<HTMLButtonElement>;
  onRemove: () => void;
}) {
  const price = complexHeadlinePrice(complex);
  const total = complexListingTotal(complex);
  return (
    <article className={styles.complex}>
      <ComplexRow
        className={styles.complexRow}
        href={ROUTES.complex(complex.id)}
        linkAs={Link}
        name={complex.name}
        meta={[complex.emdName, complexMeta(complex)].filter(Boolean).join(' · ')}
        priceDeal={price?.deal}
        priceDealLabel={price?.label}
        price={price?.text}
        counts={complex.counts ?? undefined}
        media={
          complex.coverPhotoUrl ? (
            <Image src={complex.coverPhotoUrl} alt="" fill sizes="64px" />
          ) : undefined
        }
      />
      <IconButton
        ref={removeRef}
        className={styles.complexRemove}
        variant="plain"
        pressed
        label={favoriteLabel('complexes', complex.name, true)}
        onClick={onRemove}
      >
        <Icon name="heart" size={20} filled />
      </IconButton>
      <p className={styles.complexFoot}>
        <span>
          {complex.pricePerPyeong ? `평균 ${formatPerPyeong(complex.pricePerPyeong)} · ` : ''}
          매물 <b className="num">{total.toLocaleString('ko-KR')}</b>건
        </span>
        <span>{formatDateShort(complex.favoritedAt)} 담음</span>
      </p>
    </article>
  );
}
