'use client';
import {
  Button,
  EmptyState,
  Icon,
  IconButton,
  ListingCard,
  TabPanel,
  Tabs,
  photoKindForAsset,
} from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ROUTES } from '@/config/nav';
import { listingDisplayName } from '@/lib/api/schemas/listing';
import { favoriteLabel } from '@/lib/favorites/useFavorite';
import { formatCount, formatDateShort } from '@/lib/format';
import type { ListingSummary, SimilarListings } from '../api/schemas';
import { mediaImage } from '../lib/media';
import { DEAL_KIND, headlinePrice, summaryMeta } from '../lib/view';
import { useListingInteractions } from './ListingInteractions';
import styles from './page.module.css';

function SimilarCard({ item }: { item: ListingSummary }) {
  const { isFavorite, toggleFavorite } = useListingInteractions();
  const price = headlinePrice(item);
  const on = isFavorite(item.id);
  return (
    <ListingCard
      href={ROUTES.listing(item.id)}
      linkAs={Link}
      deal={DEAL_KIND[item.dealType]}
      price={price.text}
      premium={item.premium ?? undefined}
      title={listingDisplayName(item)}
      subtitle={item.dong ?? undefined}
      meta={summaryMeta(item)}
      verifiedDate={item.verifiedAt ? formatDateShort(item.verifiedAt) : undefined}
      brokerCount={item.agencyCount}
      placeholder={photoKindForAsset(item.assetType)}
      media={
        item.coverPhotoUrl ? (
          <Image
            {...mediaImage(item.coverPhotoUrl)}
            alt=""
            fill
            loading="lazy"
            sizes="(max-width: 720px) 82vw, (max-width: 1288px) 33vw, 300px"
          />
        ) : undefined
      }
      // Passed as a slot: ListingCard's own heart loses its absolute position when the IconButton
      // stylesheet loads after the card's (CSS-module order) — see openIssues.
      favoriteSlot={
        <IconButton
          variant="floating"
          pressed={on}
          label={favoriteLabel(
            'listings',
            `${listingDisplayName(item)}${item.dong ? ` ${item.dong}` : ''}`,
            on,
          )}
          onClick={() => toggleFavorite(item.id)}
        >
          <Icon name="heart" size={20} filled={on} />
        </IconButton>
      }
    />
  );
}

export interface SimilarSectionProps {
  similar: SimilarListings;
  /** Map URL around this listing. */
  mapHref: string;
}

/** 비슷한 매물: tabs per criterion (같은 단지 / 같은 평형 / 같은 가격대), horizontal snap list on mobile. */
export function SimilarSection({ similar, mapHref }: SimilarSectionProps) {
  const groups = similar.groups;
  const [tab, setTab] = useState<string>(groups[0]?.key ?? '');
  const current = groups.some((g) => g.key === tab) ? tab : (groups[0]?.key ?? '');
  const mapLabel = similar.regionName
    ? `${similar.regionName} 매물${similar.regionListingCount ? ` ${formatCount(similar.regionListingCount)}건` : ''} 지도에서 보기`
    : '주변 매물 지도에서 보기';

  return (
    <section className={styles.sim} aria-labelledby="s-sim">
      <div className={styles.simHd}>
        <div>
          <h2 className="t-h2" id="s-sim">
            비슷한 매물
          </h2>
          {similar.criteria && <p className="t-sm">{similar.criteria}</p>}
        </div>
        <Button
          href={mapHref}
          linkAs={Link}
          variant="secondary"
          size="sm"
          className={styles.simMap}
          iconRight={<Icon name="arrow-right" size={16} />}
        >
          {mapLabel}
        </Button>
      </div>
      {groups.length === 0 ? (
        <EmptyState
          compact
          icon="home-search"
          title="조건이 비슷한 매물이 아직 없어요"
          description="지도에서 주변 매물을 넓게 살펴보세요."
        />
      ) : (
        <>
          <Tabs
            label="비슷한 매물 기준"
            idBase="listing-sim"
            className={styles.simTabs}
            items={groups.map((g) => ({ value: g.key, label: g.label, count: g.total }))}
            value={current}
            onChange={setTab}
          />
          {groups.map((g) => (
            <TabPanel key={g.key} idBase="listing-sim" value={g.key} current={current}>
              <div className={styles.simGrid}>
                {g.items.map((item) => (
                  <SimilarCard key={item.id} item={item} />
                ))}
              </div>
            </TabPanel>
          ))}
        </>
      )}
    </section>
  );
}
