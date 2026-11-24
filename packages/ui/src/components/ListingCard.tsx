import type { ReactNode } from 'react';
import styles from './ListingCard.module.css';
import { cx } from '../lib/cx';
import type { DealKind, LinkAs } from '../lib/types';
import { BrokersBadge, DealLabel, PremiumBadge, VerifiedBadge } from './Badge';
import { IconButton } from './IconButton';
import { PhotoPlaceholder, type PhotoKind } from './PhotoPlaceholder';
import { Icon } from '../icons/Icon';

export interface ListingCardProps {
  href: string;
  linkAs?: LinkAs;
  deal: DealKind;
  /** Override the deal caption (defaults to 매매/전세/월세/분양권). */
  dealLabel?: string;
  /** Formatted price: "4억 4,500", "500/42" … (use the app's format utils). */
  price: string;
  /** 분양권 premium in 만원 (shows the P chip). */
  premium?: number;
  /** Complex / building name. */
  title: string;
  /** Lighter text after the title: 동 or location hint. */
  subtitle?: string;
  /** Short facts joined with "·": ["전용 85㎡(26평)", "고/25층", "남향"] (area in ㎡, 평 alongside). */
  meta?: readonly string[];
  /** 실매물 확인 date, e.g. "26.11.22". */
  verifiedDate?: string;
  /** Number of co-brokering offices ("중개사 N곳"). */
  brokerCount?: number;
  /** Photo node — `<Image fill sizes=… alt=… />`. Falls back to the branded placeholder. */
  media?: ReactNode;
  placeholder?: PhotoKind;
  /** Heart state + handler (client usage). */
  favorite?: boolean;
  onFavoriteChange?: (next: boolean) => void;
  /** Or pass your own favourite control (server components). */
  favoriteSlot?: ReactNode;
  /** Heading level for the title (default h3). */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

/**
 * Listing card. Reading order: deal label → big price → complex · 동 → 평 · 층 · 향 → 실매물 확인.
 * The whole card is one link (stretched from the title); the heart stays independently clickable.
 */
export function ListingCard({
  href,
  linkAs,
  deal,
  dealLabel,
  price,
  premium,
  title,
  subtitle,
  meta,
  verifiedDate,
  brokerCount,
  media,
  placeholder = 'tower',
  favorite,
  onFavoriteChange,
  favoriteSlot,
  headingLevel = 3,
  className,
}: ListingCardProps) {
  const Link = linkAs ?? 'a';
  const Heading: 'h2' | 'h3' | 'h4' = `h${headingLevel}`;
  return (
    <article className={cx(styles.card, className)}>
      <div className={styles.photo}>
        {media ?? <PhotoPlaceholder kind={placeholder} className={styles.art} />}
        {brokerCount !== undefined && brokerCount > 0 && (
          <BrokersBadge count={brokerCount} className={styles.brokers} />
        )}
        {favoriteSlot ? (
          <span className={styles.fav}>{favoriteSlot}</span>
        ) : onFavoriteChange ? (
          <IconButton
            className={styles.fav}
            variant="floating"
            pressed={!!favorite}
            label={`${title} 관심 매물${favorite ? '에서 삭제' : '에 추가'}`}
            onClick={() => onFavoriteChange(!favorite)}
          >
            <Icon name="heart" size={20} filled={!!favorite} />
          </IconButton>
        ) : null}
      </div>
      <div className={styles.body}>
        <DealLabel deal={deal}>{dealLabel}</DealLabel>
        <div className={styles.priceRow}>
          <p className="price">{price}</p>
          {premium !== undefined && <PremiumBadge amount={premium} />}
        </div>
        <Heading className={styles.name}>
          <Link href={href} className={styles.link}>
            {title}
            {subtitle && <span> {subtitle}</span>}
          </Link>
        </Heading>
        {meta && meta.length > 0 && (
          <p className={styles.meta}>
            {meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </p>
        )}
      </div>
      <div className={styles.foot}>
        {verifiedDate ? (
          <VerifiedBadge date={verifiedDate} />
        ) : (
          <span className={styles.unverified}>확인일 미등록</span>
        )}
        <Icon name="chevron-right" size={18} className={styles.chev} />
      </div>
    </article>
  );
}
