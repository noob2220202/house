'use client';
import { Icon, IconButton, ListingCard, cx } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import type { Ref } from 'react';
import { favoriteLabel } from '@/lib/favorites/useFavorite';
import { toListingCardModel } from '../lib/listing-card';
import type { ListingSummary } from '../schemas';
import styles from './MeListingCard.module.css';

export interface MeListingCardProps {
  listing: ListingSummary;
  favorite: boolean;
  onFavoriteChange: (next: boolean) => void;
  /** Ref of the heart button (lists move focus to a neighbour when a card is removed). */
  favoriteRef?: Ref<HTMLButtonElement>;
  headingLevel?: 2 | 3 | 4;
  /** Marks the first visible photos as eager (LCP). */
  priority?: boolean;
  className?: string;
}

/**
 * Listing card of the my-page lists: the shared <ListingCard> fed from the API summary, with the
 * real cover photo when there is one and a status label when the listing left the market.
 *
 * A listing that is off the market (거래완료 / 광고 종료) keeps full-contrast text — it is still a
 * link people read — and is marked by the status pill, a grey photo and a muted price. Its foot
 * says so instead of showing the green "실매물 확인" badge, which would contradict the pill.
 */
export function MeListingCard({
  listing,
  favorite,
  onFavoriteChange,
  favoriteRef,
  headingLevel = 3,
  priority,
  className,
}: MeListingCardProps) {
  const m = toListingCardModel(listing);
  const name = [m.title, m.subtitle].filter(Boolean).join(' ');
  const status = m.inactiveLabel ?? (m.reserved ? '계약중' : null);
  return (
    <div className={cx(styles.cell, className)}>
      <ListingCard
        href={m.href}
        linkAs={Link}
        deal={m.deal}
        dealLabel={m.dealLabel}
        price={m.price}
        premium={m.premium}
        title={m.title}
        subtitle={m.subtitle}
        meta={m.meta}
        verifiedDate={m.verifiedDate}
        brokerCount={status ? undefined : m.brokerCount}
        placeholder={m.placeholder}
        media={
          m.photoUrl ? (
            <Image
              src={m.photoUrl}
              alt={m.photoAlt}
              fill
              sizes="(max-width: 720px) 100vw, 320px"
              priority={priority}
            />
          ) : undefined
        }
        // Own control in the slot: the card positions the slot itself, independent of CSS order.
        favoriteSlot={
          <IconButton
            ref={favoriteRef}
            variant="floating"
            pressed={favorite}
            label={favoriteLabel('listings', name, favorite)}
            onClick={() => onFavoriteChange(!favorite)}
          >
            <Icon name="heart" size={20} filled={favorite} />
          </IconButton>
        }
        headingLevel={headingLevel}
        className={cx(styles.card, m.inactiveLabel && styles.inactive)}
      />
      {status && (
        <span className={cx(styles.status, m.inactiveLabel ? styles.closed : styles.reserved)}>
          {status}
        </span>
      )}
      {/* <ListingCard> has no foot slot yet: its own foot text is hidden for inactive cards
          (MeListingCard.module.css) and this note takes its place. */}
      {m.inactiveNote && <p className={styles.footNote}>{m.inactiveNote}</p>}
    </div>
  );
}
