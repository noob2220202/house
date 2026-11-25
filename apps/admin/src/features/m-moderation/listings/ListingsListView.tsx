'use client';
import { ASSET_TYPE_LABEL, AssetType, DEAL_TYPE_LABEL, DealType } from '@house/shared';
import {
  Badge,
  Button,
  DealBadge,
  Icon,
  ListSearchField,
  Panel,
  PhotoPlaceholder,
  StatusPill,
  dealKindOf,
  photoKindForAsset,
  type TableColumn,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo } from 'react';
import { formatCount, formatDateShort } from '@/lib/format';
import l from './listings.module.css';
import { MOD_PAGE_SIZE, fetchCounts, fetchListings, modKeys } from '../api/queries';
import type { AdminListingListItem } from '../api/schemas';
import {
  LISTING_STATUS_META,
  REVIEW_FLAG_LABEL,
  listingName,
  listingPrice,
  listingSpec,
} from '../lib/labels';
import { hasActiveFilters, type ParamSpec } from '../lib/list-params';
import { useListParams } from '../lib/use-list-params';
import { MediaImage } from '../ui/MediaImage';
import {
  FilterSelect,
  ListHead,
  ModCard,
  ModList,
  ResetFiltersButton,
  RowActions,
  RowLink,
} from '../ui/ModList';
import s from '../ui/ui.module.css';

const TAB_VALUES = ['ALL', 'REVIEW', 'ACTIVE', 'RESERVED', 'CLOSED', 'HIDDEN'] as const;
type Tab = (typeof TAB_VALUES)[number];
const SORT_VALUES = ['LATEST', 'REPORTS', 'VIEWS', 'PRICE_DESC'] as const;

const SPEC = {
  tab: { kind: 'enum', values: TAB_VALUES, fallback: 'ALL' },
  assetType: { kind: 'enum', values: Object.values(AssetType) },
  dealType: { kind: 'enum', values: Object.values(DealType) },
  sort: { kind: 'enum', values: SORT_VALUES, fallback: 'LATEST' },
  q: { kind: 'text' },
} as const satisfies ParamSpec;

const TAB_LABEL: Record<Tab, string> = {
  ALL: '전체',
  REVIEW: '검수 필요',
  ACTIVE: LISTING_STATUS_META.ACTIVE.label,
  RESERVED: LISTING_STATUS_META.RESERVED.label,
  CLOSED: LISTING_STATUS_META.CLOSED.label,
  HIDDEN: LISTING_STATUS_META.HIDDEN.label,
};
const tabQuery = (tab: Tab) =>
  tab === 'ALL' ? {} : tab === 'REVIEW' ? { needsReview: 'true' } : { status: tab };
const COUNT_QUERIES = Object.fromEntries(TAB_VALUES.map((t) => [t, tabQuery(t)])) as Record<
  Tab,
  Record<string, string>
>;

const ASSET_OPTIONS = [
  { value: '', label: '전체' },
  ...Object.values(AssetType).map((v) => ({ value: v, label: ASSET_TYPE_LABEL[v] })),
];
const DEAL_OPTIONS = [
  { value: '', label: '전체' },
  ...Object.values(DealType).map((v) => ({ value: v, label: DEAL_TYPE_LABEL[v] })),
];
const SORT_OPTIONS = [
  { value: 'LATEST', label: '최근 등록순' },
  { value: 'REPORTS', label: '신고 많은 순' },
  { value: 'VIEWS', label: '조회 많은 순' },
  { value: 'PRICE_DESC', label: '높은 가격순' },
];

export const listingHref = (id: string) => `/listings/${id}`;

function Thumb({ listing }: { listing: AdminListingListItem }) {
  return (
    <span className={s.thumb}>
      {listing.coverUrl ? (
        <MediaImage src={listing.coverUrl} alt="" sizes="64px" />
      ) : (
        <PhotoPlaceholder kind={photoKindForAsset(listing.assetType)} />
      )}
    </span>
  );
}

function Price({ listing }: { listing: AdminListingListItem }) {
  return (
    <span className={l.priceRow}>
      <DealBadge deal={dealKindOf(listing.dealType)} />
      <span className={l.price}>{listingPrice(listing)}</span>
    </span>
  );
}

function StatusCell({ listing }: { listing: AdminListingListItem }) {
  const meta = LISTING_STATUS_META[listing.status];
  return (
    <span className={s.tagRow}>
      <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
      {listing.reviewFlags.map((flag) => (
        <Badge key={flag} tone={flag === 'REPORTED' ? 'danger' : 'warn'}>
          {flag === 'REPORTED' && listing.openReportCount > 0
            ? `신고 ${listing.openReportCount}건`
            : REVIEW_FLAG_LABEL[flag]}
        </Badge>
      ))}
    </span>
  );
}

/** 매물 검수: listing search + moderation queue (`/listings`). */
export function ListingsListView() {
  const { values, set, reset, hrefFor } = useListParams(SPEC);
  const tab = values.tab as Tab;

  const query = useMemo(
    () => ({
      ...tabQuery(tab),
      assetType: values.assetType || undefined,
      dealType: values.dealType || undefined,
      sort: values.sort === 'LATEST' ? undefined : values.sort,
      q: values.q || undefined,
      page: values.page,
      pageSize: MOD_PAGE_SIZE,
    }),
    [tab, values.assetType, values.dealType, values.sort, values.q, values.page],
  );
  const list = useQuery({
    queryKey: modKeys.listings(query),
    queryFn: ({ signal }) => fetchListings(query, signal),
    placeholderData: keepPreviousData,
  });
  const counts = useQuery({
    queryKey: modKeys.listingCounts,
    queryFn: ({ signal }) => fetchCounts('/admin/listings', COUNT_QUERIES, signal),
  });

  const columns = useMemo<TableColumn<AdminListingListItem>[]>(
    () => [
      {
        key: 'listing',
        header: '매물',
        cell: (row) => (
          <div className={s.cellMain}>
            <Thumb listing={row} />
            <span className={s.cellText}>
              <RowLink href={listingHref(row.id)}>{listingName(row)}</RowLink>
              <span className={s.cellSub}>
                {[ASSET_TYPE_LABEL[row.assetType], row.emdName, listingSpec(row)]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </div>
        ),
      },
      { key: 'price', header: '거래 · 가격', cell: (row) => <Price listing={row} /> },
      {
        key: 'agency',
        header: '중개사무소',
        cell: (row) => (
          <span className={s.cellStack}>
            <span className={s.cellStrong}>{row.primaryAgency.name}</span>
            <span className={s.mutedText} style={{ fontSize: 12 }}>
              {row.agencyCount > 1 ? `공동중개 ${row.agencyCount}곳` : '단독 중개'}
            </span>
          </span>
        ),
      },
      {
        key: 'verified',
        header: '실매물 확인',
        cell: (row) =>
          row.verifiedAt ? (
            <span className={s.num}>{formatDateShort(row.verifiedAt)}</span>
          ) : (
            <span className={s.warnText}>미확인</span>
          ),
      },
      { key: 'status', header: '상태', cell: (row) => <StatusCell listing={row} /> },
      {
        key: 'views',
        header: '조회 · 관심',
        align: 'right',
        cell: (row) => (
          <span className={s.num}>
            {formatCount(row.viewCount)} · {formatCount(row.favoriteCount)}
          </span>
        ),
      },
      {
        key: 'open',
        header: '관리',
        align: 'right',
        cell: (row) => (
          <RowActions>
            <Button size="sm" variant="secondary" href={listingHref(row.id)} linkAs={Link}>
              검수
            </Button>
          </RowActions>
        ),
      },
    ],
    [],
  );

  const filtered = hasActiveFilters(values, SPEC, ['tab', 'sort']);
  return (
    <div className={s.page}>
      <ListHead
        label="매물 상태"
        current={tab}
        tabs={TAB_VALUES.map((value) => ({
          value,
          label: TAB_LABEL[value],
          count: counts.data?.[value],
          href: hrefFor({ tab: value, page: 1 }),
        }))}
      >
        <ListSearchField
          className={s.search}
          label="매물 검색"
          placeholder="단지·건물명, 주소, 중개사무소 검색"
          value={values.q}
          onSearch={(q, mode) => set({ q }, { replace: mode === 'typing' })}
        />
      </ListHead>

      <Panel
        flush
        title={tab === 'REVIEW' ? '검수가 필요한 매물' : '매물 목록'}
        count={list.data ? formatCount(list.data.total) : undefined}
        description={tab === 'REVIEW' ? '신고 접수 · 실매물 미확인' : undefined}
        actions={
          <div className={s.filters}>
            {filtered && <ResetFiltersButton onClick={() => reset({ tab, sort: values.sort })} />}
            <FilterSelect
              field="매물 종류"
              options={ASSET_OPTIONS}
              value={values.assetType}
              onChange={(assetType) => set({ assetType })}
            />
            <FilterSelect
              field="거래 유형"
              options={DEAL_OPTIONS}
              value={values.dealType}
              onChange={(dealType) => set({ dealType })}
            />
            <FilterSelect
              field="정렬"
              options={SORT_OPTIONS}
              value={values.sort}
              onChange={(sort) => set({ sort })}
            />
          </div>
        }
      >
        <ModList
          caption="매물 목록"
          columns={columns}
          rowKey={(row) => row.id}
          rowHref={(row) => listingHref(row.id)}
          data={list.data}
          isPending={list.isPending}
          isFetching={list.isPlaceholderData}
          error={list.error}
          onRetry={() => void list.refetch()}
          footerNote={SORT_OPTIONS.find((o) => o.value === values.sort)?.label}
          hrefForPage={(page) => hrefFor({ page })}
          empty={
            filtered
              ? {
                  title: '조건에 맞는 매물이 없어요',
                  description: '검색어나 필터를 바꿔 보세요.',
                  action: (
                    <Button size="sm" variant="secondary" onClick={() => reset({ tab })}>
                      필터 초기화
                    </Button>
                  ),
                }
              : tab === 'REVIEW'
                ? {
                    icon: 'check-circle',
                    title: '검수가 필요한 매물이 없어요',
                    description: '신고가 들어오거나 실매물 확인 기한이 지나면 이곳에 모여요.',
                  }
                : { icon: 'building', title: `${TAB_LABEL[tab]} 매물이 없어요` }
          }
          renderCard={(row) => (
            <ModCard
              href={listingHref(row.id)}
              title={listingName(row)}
              badge={
                <StatusPill tone={LISTING_STATUS_META[row.status].tone}>
                  {LISTING_STATUS_META[row.status].label}
                </StatusPill>
              }
              meta={
                <>
                  <span>
                    {[ASSET_TYPE_LABEL[row.assetType], row.emdName, listingSpec(row)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span>
                    {row.primaryAgency.name}
                    {row.agencyCount > 1 ? ` 외 ${row.agencyCount - 1}곳` : ''} ·{' '}
                    {row.verifiedAt ? `확인 ${formatDateShort(row.verifiedAt)}` : '실매물 미확인'}
                  </span>
                </>
              }
            >
              <Price listing={row} />
              {row.reviewFlags.length > 0 && (
                <div className={s.tagRow}>
                  {row.reviewFlags.map((flag) => (
                    <Badge key={flag} tone={flag === 'REPORTED' ? 'danger' : 'warn'}>
                      {flag === 'REPORTED' && row.openReportCount > 0
                        ? `신고 ${row.openReportCount}건`
                        : REVIEW_FLAG_LABEL[flag]}
                    </Badge>
                  ))}
                </div>
              )}
            </ModCard>
          )}
        />
      </Panel>
      <p className={s.iconNote}>
        <Icon name="info" size={14} />
        작성 중(임시 저장) 매물은 검수 대상이 아니라 목록에 나오지 않아요.
      </p>
    </div>
  );
}
