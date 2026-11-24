'use client';
import { Button, EmptyState, ErrorState, Skeleton, Spinner, cx } from '@house/ui';
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, errorMessage } from '@/lib/api';
import { formatCount } from '@/lib/format';
import {
  complexKeys,
  fetchComplex,
  fetchComplexListings,
  featuredBannersQuery,
} from '../api/queries';
import {
  activeFilterCount,
  clearedFilters,
  sortOf,
  toListingQuery,
  unitOf,
  type PanelFilterValues,
} from '../lib/filters';
import { FeaturedAgencyCard } from './FeaturedAgencyCard';
import { ListingRow } from './ListingRow';
import {
  NearbyPresale,
  NearbyPresaleSkeleton,
  useNearbyPresale,
  type NearbyPresaleState,
} from './NearbyPresale';
import { PanelFilterBar } from './PanelFilterBar';
import { PanelHeader } from './PanelHeader';
import { PanelSummaryBar } from './PanelSummaryBar';
import { TrendCard } from './TrendCard';
import styles from './panel.module.css';

const PAGE_SIZE = 20;

export interface ComplexPanelProps {
  /** Complex id (`?complex=<id>` on the map route). */
  complexId: string;
  /** Href of the map without a selected complex (back arrow). */
  backHref: string;
  /** Href that opens another complex in this panel (nearby 분양권 strip). */
  complexHref: (id: string) => string;
  filters: PanelFilterValues;
  onFiltersChange: (patch: Partial<PanelFilterValues>, options?: { replace?: boolean }) => void;
  /** Phones: draw the panel as a sheet overlapping the map above it (rounded top + grab handle). */
  sheet?: boolean;
  /**
   * Who scrolls the panel on phones (desktop: always the panel itself).
   * - 'self' (default): the panel fills its host and scrolls inside — e.g. a fixed-height bottom sheet.
   * - 'host': the panel grows with its content and the host element scrolls (map above, panel below).
   */
  scroll?: 'self' | 'host';
  className?: string;
}

function PanelSkeleton() {
  return (
    <div aria-hidden="true">
      <div className={styles.hd}>
        <div style={{ paddingLeft: 42 }}>
          <Skeleton width={150} height={14} />
          <Skeleton width={230} height={28} style={{ marginTop: 8 }} />
        </div>
        <Skeleton width="80%" height={16} style={{ marginLeft: 8 }} />
      </div>
      <div className={styles.sec}>
        <Skeleton width="100%" height={104} radius="var(--r-lg)" />
      </div>
      <div className={styles.filter}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={96} height={36} radius="var(--r-md)" />
        ))}
      </div>
      <RowSkeletons count={4} />
    </div>
  );
}

function RowSkeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.skRow} aria-hidden="true">
          <div className={styles.skCol}>
            <Skeleton width={170} height={24} />
            <Skeleton width="85%" height={16} />
            <Skeleton width="60%" height={14} />
          </div>
          <Skeleton width="100%" height={76} radius="var(--r-md)" />
        </div>
      ))}
    </>
  );
}

/**
 * Complex detail panel shown in the map's left column for `/map/apt?complex=<id>` (Complex.dc.html):
 * header actions, facts, 실거래가 card, filters, counts + 평/㎡ + sort, the COMPLEX_FEATURED_AGENCY ad
 * card and the infinite listing list with the "중개사무소 N곳" disclosure.
 *
 * The panel is self-contained (it fetches everything it shows); the host supplies the URL state.
 * Give it a box with a definite height — it scrolls inside. On phones a host that scrolls itself
 * passes `scroll="host"` and the panel grows with its content instead.
 */
export function ComplexPanel({
  complexId,
  backHref,
  complexHref,
  filters,
  onFiltersChange,
  sheet,
  scroll = 'self',
  className,
}: ComplexPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);

  // Side content of the list starts loading with the panel (in parallel with the complex and the
  // list) so it is settled before the rows render and never pushes them down.
  const featured = useQuery(featuredBannersQuery(complexId));
  const nearPresale = useNearbyPresale(complexId);

  const complexQuery = useQuery({
    queryKey: complexKeys.detail(complexId),
    queryFn: ({ signal }) => fetchComplex(complexId, signal),
    staleTime: 5 * 60_000,
  });
  const complex = complexQuery.data;
  const areaTypes = useMemo(() => complex?.areaTypes ?? [], [complex]);
  const unit = unitOf(filters);
  const sort = sortOf(filters);
  const listQuery = useMemo(() => toListingQuery(filters, areaTypes), [filters, areaTypes]);

  const listings = useInfiniteQuery({
    queryKey: complexKeys.listings(complexId, { ...listQuery, pageSize: PAGE_SIZE }),
    queryFn: ({ pageParam, signal }) =>
      fetchComplexListings(
        complexId,
        { ...listQuery, page: pageParam, pageSize: PAGE_SIZE },
        signal,
      ),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    enabled: !!complex,
    placeholderData: keepPreviousData,
  });
  const first = listings.data?.pages[0];
  const items = useMemo(() => listings.data?.pages.flatMap((p) => p.items) ?? [], [listings.data]);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = listings;

  // Infinite list: load the next page when the sentinel scrolls into view.
  useEffect(() => {
    const el = moreRef.current;
    if (!el || !hasNextPage || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: '240px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

  // A different list (filters / sort) closes the open co-broker list. Keyed on the serialized query,
  // not the object: other URL params (map pan / zoom, 평/㎡) re-parse the filters without changing it.
  // (Esc is handled by the row itself.)
  const listKey = JSON.stringify(listQuery);
  useEffect(() => setOpenId(null), [listKey, complexId]);

  const root = cx(
    styles.cp,
    sheet && styles.sheet,
    scroll === 'host' && styles.hostScroll,
    className,
  );

  if (complexQuery.isPending) {
    return (
      <aside className={root} aria-label="단지 상세" aria-busy="true">
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.scroll}>
          <span className="sr-only" role="status">
            단지 정보를 불러오는 중이에요
          </span>
          <PanelSkeleton />
        </div>
      </aside>
    );
  }

  if (complexQuery.isError || !complex) {
    const notFound = complexQuery.error instanceof ApiError && complexQuery.error.isNotFound;
    return (
      <aside className={root} aria-label="단지 상세">
        <span className={styles.handle} aria-hidden="true" />
        <div className={cx(styles.scroll, styles.state)}>
          {notFound ? (
            <EmptyState
              icon="building"
              title="단지를 찾을 수 없어요"
              description="삭제되었거나 주소가 잘못된 단지예요."
              action={
                <Button variant="secondary" href={backHref}>
                  단지 목록으로
                </Button>
              }
            />
          ) : (
            <ErrorState
              title="단지 정보를 불러오지 못했어요"
              description={errorMessage(complexQuery.error)}
              onRetry={() => void complexQuery.refetch()}
              action={
                <Button variant="ghost" href={backHref}>
                  단지 목록으로
                </Button>
              }
            />
          )}
        </div>
      </aside>
    );
  }

  const filtered = activeFilterCount(filters) > 0;
  const refreshing = listings.isPlaceholderData && listings.isFetching;

  return (
    <aside className={root} aria-label={`${complex.name} 단지 상세`}>
      <span className={styles.handle} aria-hidden="true" />
      <div className={cx(styles.scroll, styles.fade)}>
        <PanelHeader complex={complex} backHref={backHref} />
        {areaTypes.length > 0 && (
          <div className={styles.sec}>
            <TrendCard complexId={complex.id} areaTypes={areaTypes} unit={unit} />
          </div>
        )}
        <PanelFilterBar
          filters={filters}
          onChange={(patch) => onFiltersChange(patch)}
          areaTypes={areaTypes}
          summary={first?.summary}
          unit={unit}
        />
        <PanelSummaryBar
          total={first?.total}
          summary={first?.summary}
          unit={unit}
          onUnitChange={(u) => onFiltersChange({ 'c-unit': u }, { replace: true })}
          sort={sort}
          onSortChange={(s) => onFiltersChange({ 'c-sort': s }, { replace: true })}
        />
        <FeaturedAgencyCard complexId={complex.id} />

        {listings.isPending || featured.isPending ? (
          <div className={styles.rows} role="status" aria-label="매물 목록을 불러오는 중">
            <RowSkeletons count={5} />
          </div>
        ) : listings.isError ? (
          <div className={styles.state}>
            <ErrorState
              compact
              title="매물 목록을 불러오지 못했어요"
              description={errorMessage(listings.error)}
              onRetry={() => void listings.refetch()}
            />
          </div>
        ) : items.length === 0 ? (
          <div className={styles.state}>
            <EmptyState
              compact
              icon="search"
              title={filtered ? '조건에 맞는 매물이 없어요' : '등록된 매물이 아직 없어요'}
              description={
                filtered
                  ? '조건을 넓히면 더 많은 매물을 볼 수 있어요.'
                  : '새 매물이 등록되면 이곳에 표시돼요.'
              }
              action={
                filtered ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onFiltersChange(clearedFilters())}
                  >
                    조건 초기화
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <ul className={cx(styles.rows, refreshing && styles.busy)} aria-label="매물 목록">
              {items.map((listing, i) => (
                <ListingRowWithStrip
                  key={listing.id}
                  strip={i === 0 && !filtered ? nearPresale : null}
                  complexHref={complexHref}
                >
                  <ListingRow
                    listing={listing}
                    unit={unit}
                    open={openId === listing.id}
                    onToggle={() => setOpenId((id) => (id === listing.id ? null : listing.id))}
                  />
                </ListingRowWithStrip>
              ))}
            </ul>
            {hasNextPage ? (
              <div ref={moreRef} className={styles.more}>
                {isFetchingNextPage ? (
                  <Spinner label="매물을 더 불러오는 중" />
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => void fetchNextPage()}>
                    매물 더 보기 ({formatCount(items.length)} / {formatCount(first?.total ?? 0)})
                  </Button>
                )}
              </div>
            ) : (
              items.length > PAGE_SIZE && (
                <p className={styles.end}>매물 {formatCount(items.length)}건을 모두 확인했어요</p>
              )
            )}
          </>
        )}
      </div>
    </aside>
  );
}

/** Renders a row and, after the first one, the "근처 분양권" strip (as in the design). */
function ListingRowWithStrip({
  children,
  strip,
  complexHref,
}: {
  children: React.ReactNode;
  /** Strip state when the strip follows this row, else null. */
  strip: NearbyPresaleState | null;
  complexHref: (id: string) => string;
}) {
  return (
    <>
      {children}
      {strip?.status === 'pending' && <NearbyPresaleSkeleton />}
      {strip?.status === 'ready' && (
        <NearbyPresale target={strip.target} listings={strip.listings} complexHref={complexHref} />
      )}
    </>
  );
}
