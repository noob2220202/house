'use client';
import { DEAL_TYPE_LABEL, DealType, LISTING_SORT_LABEL, type AssetType } from '@house/shared';
import {
  Button,
  Chip,
  EmptyState,
  ErrorState,
  ListingCardSkeleton,
  LoadingRegion,
  Pagination,
  Select,
  TabPanel,
  Tabs,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { usePathname, useSearchParams } from 'next/navigation';
import { useMemo, useRef } from 'react';
import {
  AGENCY_LISTINGS_PAGE_SIZE,
  agencyKeys,
  agencyListingsQuery,
  fetchAgencyListings,
} from '../api/queries';
import type { AgencyListingPage } from '../api/schemas';
import { SPECIALTY_LABEL } from '../lib/agency';
import {
  AGENCY_LISTING_SORTS,
  parseListingParams,
  serializeListingParams,
  type ListingViewParams,
} from '../lib/listing-params';
import { AgencyListingItem } from './AgencyListingItem';
import styles from './AgencyPage.module.css';
import { formatCount } from '@/lib/format';

const ALL = 'ALL';
const ASSET_ORDER: readonly AssetType[] = [
  'APT',
  'OFFICETEL',
  'ONEROOM',
  'HOUSE',
  'COMMERCIAL',
  'LAND',
];
const DEALS: readonly DealType[] = [
  DealType.SALE,
  DealType.JEONSE,
  DealType.MONTHLY,
  DealType.PRESALE,
];

export interface AgencyListingsProps {
  agencyId: string;
  agencyName: string;
  /** Active listings in total and per asset type (tab counts). */
  total: number;
  countsByAsset: Partial<Record<AssetType, number>>;
  /** Server-rendered page for `initialKey` (JSON of the listings query). */
  initialPage: AgencyListingPage | null;
  initialKey: string;
  /**
   * The office's own 홈페이지: only listings it registered first (`primaryAgencyId`); the cards
   * then show no co-brokerage count (the site's listing page names this office only).
   */
  primaryOnly?: boolean;
  /** Numbers on the tabs (default: on). Off when `total` / `countsByAsset` may be inexact. */
  showCounts?: boolean;
}

/**
 * All listings of one office: asset-type tabs, deal chips, sort, paged card grid.
 * Filters live in the query string (`?type&deal&sort&page`) without a server round trip.
 */
export function AgencyListings({
  agencyId,
  agencyName,
  total,
  countsByAsset,
  initialPage,
  initialKey,
  primaryOnly = false,
  showCounts = true,
}: AgencyListingsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const params = useMemo(() => parseListingParams(new URLSearchParams(query)), [query]);
  const topRef = useRef<HTMLDivElement>(null);

  const update = (patch: Partial<ListingViewParams>, scroll = false) => {
    const sp = serializeListingParams(
      { ...params, page: 1, ...patch },
      new URLSearchParams(window.location.search),
    );
    const qs = sp.toString();
    // Shallow update: Next syncs useSearchParams with pushState, no server render needed.
    window.history.pushState(null, '', qs ? `${pathname}?${qs}` : pathname);
    if (scroll) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scope = { primaryOnly };
  const listings = useQuery({
    queryKey: agencyKeys.listings(agencyListingsQuery(agencyId, params, scope)),
    queryFn: ({ signal }) => fetchAgencyListings(agencyId, params, signal, scope),
    initialData:
      initialPage && JSON.stringify(agencyListingsQuery(agencyId, params, scope)) === initialKey
        ? initialPage
        : undefined,
    placeholderData: keepPreviousData,
  });

  const tabs = [
    { value: ALL, label: '전체', count: showCounts ? total : undefined },
    ...ASSET_ORDER.filter((a) => (countsByAsset[a] ?? 0) > 0).map((a) => ({
      value: a,
      label: SPECIALTY_LABEL[a],
      count: showCounts ? countsByAsset[a] : undefined,
    })),
  ];
  const tab = params.assetType ?? ALL;
  const page = listings.data;
  const filtered = params.assetType !== null || params.dealType !== null;

  return (
    <div ref={topRef} className={styles.listings}>
      <Tabs
        label="매물 종류"
        idBase="agency-listings"
        items={tabs}
        value={tab}
        onChange={(v) => update({ assetType: v === ALL ? null : (v as AssetType) })}
      />
      <div className={styles.listTools}>
        <div className={styles.dealChips} role="group" aria-label="거래 유형">
          <Chip selected={params.dealType === null} onClick={() => update({ dealType: null })}>
            전체
          </Chip>
          {DEALS.map((d) => (
            <Chip
              key={d}
              selected={params.dealType === d}
              onClick={() => update({ dealType: params.dealType === d ? null : d })}
            >
              {DEAL_TYPE_LABEL[d]}
            </Chip>
          ))}
        </div>
        <Select
          aria-label="정렬"
          className={styles.sort}
          value={params.sort}
          onChange={(e) => update({ sort: e.target.value as ListingViewParams['sort'] })}
          options={AGENCY_LISTING_SORTS.map((s) => ({ value: s, label: LISTING_SORT_LABEL[s] }))}
        />
      </div>

      <TabPanel idBase="agency-listings" value={tab} current={tab}>
        {listings.isPending ? (
          <LoadingRegion label="매물을 불러오는 중" className={styles.cardGrid}>
            {Array.from({ length: 6 }, (_, i) => (
              <ListingCardSkeleton key={i} />
            ))}
          </LoadingRegion>
        ) : listings.isError && !page ? (
          <ErrorState
            compact
            title="매물을 불러오지 못했어요"
            description="잠시 후 다시 시도해 주세요."
            onRetry={() => void listings.refetch()}
          />
        ) : !page || page.items.length === 0 ? (
          <EmptyState
            compact
            icon="building"
            title={filtered ? '조건에 맞는 매물이 없어요' : '지금 올라온 매물이 없어요'}
            description={
              filtered
                ? '다른 종류나 거래 유형을 선택해 보세요.'
                : `${agencyName}에 전화로 문의하면 등록 전 매물도 안내받을 수 있어요.`
            }
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => update({ assetType: null, dealType: null })}
                >
                  전체 매물 보기
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <p className={styles.resultCount} aria-live="polite">
              <b className="num">{formatCount(page.total)}</b>건
              {page.totalPages > 1 && (
                <span>
                  {' '}
                  · {(page.page - 1) * AGENCY_LISTINGS_PAGE_SIZE + 1}–
                  {(page.page - 1) * AGENCY_LISTINGS_PAGE_SIZE + page.items.length}번째
                </span>
              )}
            </p>
            {/* One list: cards on wide screens, compact rows on phones (CSS switch on the same
                markup → no layout shift, no second copy of the list). */}
            <ul
              className={styles.listingList}
              data-stale={listings.isPlaceholderData || undefined}
              aria-busy={listings.isFetching || undefined}
            >
              {page.items.map((l) => (
                <li key={l.id}>
                  <AgencyListingItem listing={l} showBrokerCount={!primaryOnly} />
                </li>
              ))}
            </ul>
            {page.totalPages > 1 && (
              <Pagination
                className={styles.pager}
                page={page.page}
                totalPages={page.totalPages}
                onChange={(p) => update({ page: p }, true)}
              />
            )}
          </>
        )}
      </TabPanel>
    </div>
  );
}
