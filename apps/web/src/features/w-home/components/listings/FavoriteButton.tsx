'use client';
import { Icon, IconButton, cx } from '@house/ui';
import { useFavorite } from '@/lib/favorites/useFavorite';
import styles from './FavoriteButton.module.css';

export interface FavoriteButtonProps {
  listingId: string;
  /** Listing name for the accessible label. */
  name: string;
  /** 44 on cards, 32 visual size inside a 44 hit area on the compact mobile card. */
  compact?: boolean;
  className?: string;
}

/**
 * 관심 매물 heart (shared favourites module). Signed-out visitors log in and come back to this
 * page with the heart added; signed-in users toggle optimistically.
 */
export function FavoriteButton({ listingId, name, compact, className }: FavoriteButtonProps) {
  const fav = useFavorite('listings', listingId, name);
  if (compact) {
    // MobileHome `.nl-like`: 32px disc inside a 44px touch target.
    return (
      <button
        type="button"
        className={cx(styles.like, fav.on && styles.on, className)}
        aria-label={fav.label}
        aria-pressed={fav.on}
        onClick={fav.toggle}
      >
        <span>
          <Icon name="heart" size={18} filled={fav.on} />
        </span>
      </button>
    );
  }
  return (
    <IconButton
      className={className}
      variant="floating"
      pressed={fav.on}
      label={fav.label}
      onClick={fav.toggle}
    >
      <Icon name="heart" size={20} filled={fav.on} />
    </IconButton>
  );
}
