'use client';
import { AssetType } from '@house/shared';
import {
  Button,
  EmptyState,
  ErrorState,
  Icon,
  ListingCard,
  ListingCardSkeleton,
  LoadingRegion,
  SegmentedControl,
} from '@house/ui';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { MapAssetSlug } from '@/config/nav';
import { formatCount } from '@/lib/format/number';
import { fetchVerifiedListings, homeKeys } from '../../api/client';
import type { ListingPage } from '../../api/schemas';
import { HOME_LIMITS } from '../../config';
import { mapHref } from '../../lib/links';
import { toListingCard } from '../../lib/listing-card';
import { imageProps } from '../../lib/media';
import { MoreLink, SectionHeader } from '../SectionHeader';
import { FavoriteButton } from './FavoriteButton';
import { ListingMiniCard } from './ListingMiniCard';
import styles from './Listings.module.css';

const SEGMENTS: readonly {
  value: string;
  label: string;
  slug: MapAssetSlug;
  assetTypes: readonly AssetType[];
}[] = [
  { value: 'all', label: '전체', slug: 'apt', assetTypes: [] },
  { value: 'apt', label: '아파트', slug: 'apt', assetTypes: [AssetType.APT] },
  {
    value: 'oneroom',
    label: '원룸·투룸',
    slug: 'oneroom',
    assetTypes: [AssetType.ONEROOM, AssetType.OFFICETEL],
  },
  { value: 'house', label: '주택', slug: 'house', assetTypes: [AssetType.HOUSE] },
  { value: 'land', label: '토지', slug: 'land', assetTypes: [AssetType.LAND] },
];

export interface NewListingsSectionProps {
  /** Server-fetched first page (all asset types); undefined → fetched on the client. */
  initial: ListingPage | undefined;
  /** 오늘 실매물 확인을 마친 매물 수 (`GET /home/summary`). */
  verifiedToday?: number | null;
}

/** "방금 확인된 실매물": latest verified listings — a 4-card row on desktop, a swipe row on mobile. */
export function NewListingsSection({ initial, verifiedToday }: NewListingsSectionProps) {
  const [segment, setSegment] = useState('all');
  const current = SEGMENTS.find((s) => s.value === segment) ?? SEGMENTS[0]!;
  const pageSize = HOME_LIMITS.listings;

  const query = useQuery({
    queryKey: homeKeys.verifiedListings(current.assetTypes, pageSize),
    queryFn: ({ signal }) => fetchVerifiedListings(current.assetTypes, pageSize, signal),
    initialData: segment === 'all' ? initial : undefined,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const cards = useMemo(() => (query.data?.items ?? []).map(toListingCard), [query.data]);
  const moreHref = mapHref(current.slug);

  return (
    <section className={styles.section} aria-labelledby="home-new-h">
      <div className="container">
        <SectionHeader
          id="home-new-h"
          title="방금 확인된 실매물"
          caption={
            <>
              <span className="only-lg">
                중개사가 현장 확인을 마친 매물만 올라와요
                {typeof verifiedToday === 'number' && (
                  <>
                    {' '}
                    · 오늘 확인 <b className="num">{formatCount(verifiedToday)}</b>건
                  </>
                )}
              </span>
              <span className="only-sm">중개사가 직접 확인한 날짜를 함께 보여드려요</span>
            </>
          }
          actions={
            <>
              <SegmentedControl
                label="매물 종류"
                options={SEGMENTS}
                value={segment}
                onChange={setSegment}
              />
              <MoreLink href={moreHref}>전체 보기</MoreLink>
            </>
          }
          mobileMore={{ href: moreHref, label: '전체', ariaLabel: '확인된 실매물 전체 보기' }}
        />

        <div
          aria-busy={query.isFetching}
          className={query.isPlaceholderData ? styles.stale : undefined}
        >
          {query.isPending ? (
            <LoadingRegion label="매물을 불러오는 중">
              <div className={styles.row}>
                {Array.from({ length: HOME_LIMITS.listingsShown }, (_, i) => (
                  <ListingCardSkeleton key={i} className={styles.skeleton} />
                ))}
              </div>
            </LoadingRegion>
          ) : query.isError ? (
            <ErrorState
              className={styles.state}
              title="매물을 불러오지 못했어요"
              onRetry={() => void query.refetch()}
            />
          ) : cards.length === 0 ? (
            <EmptyState
              className={styles.state}
              icon="home-search"
              title={`최근 확인된 ${current.value === 'all' ? '' : `${current.label} `}매물이 아직 없어요`}
              description="지도에서 지역과 조건을 넓혀 찾아보세요."
              action={
                <Button
                  href={moreHref}
                  linkAs={Link}
                  variant="secondary"
                  iconRight={<Icon name="arrow-right" size={18} />}
                >
                  지도에서 찾기
                </Button>
              }
            />
          ) : (
            <>
              <ul className={`only-lg ${styles.row}`}>
                {cards.slice(0, HOME_LIMITS.listingsShown).map((card) => (
                  <li key={card.id}>
                    <ListingCard
                      className={styles.card}
                      href={card.href}
                      linkAs={Link}
                      deal={card.deal}
                      price={card.price}
                      premium={card.premium}
                      title={card.title}
                      subtitle={card.subtitle}
                      meta={card.meta}
                      verifiedDate={card.verifiedDate}
                      brokerCount={card.brokerCount}
                      placeholder={card.placeholder}
                      media={
                        card.coverPhotoUrl ? (
                          <Image
                            {...imageProps(card.coverPhotoUrl)}
                            alt=""
                            fill
                            sizes="(max-width: 1100px) 50vw, 300px"
                            loading="lazy"
                          />
                        ) : undefined
                      }
                      favoriteSlot={<FavoriteButton listingId={card.id} name={card.title} />}
                    />
                  </li>
                ))}
              </ul>
              <ul className={`only-sm ${styles.scroller}`} aria-label="최근 확인 매물">
                {cards.map((card) => (
                  <li key={card.id}>
                    <ListingMiniCard card={card} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
