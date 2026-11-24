import { BrokersBadge, DealLabel, PhotoPlaceholder, PremiumBadge, VerifiedBadge } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import type { ListingCardModel } from '../../lib/listing-card';
import { imageProps } from '../../lib/media';
import { FavoriteButton } from './FavoriteButton';
import styles from './Listings.module.css';

/** Compact listing card of the mobile horizontal row (MobileHome `.nl`). */
export function ListingMiniCard({ card }: { card: ListingCardModel }) {
  return (
    <article className={styles.mini}>
      <div className={styles.miniPhoto}>
        {card.coverPhotoUrl ? (
          <Image {...imageProps(card.coverPhotoUrl)} alt="" fill sizes="212px" loading="lazy" />
        ) : (
          <PhotoPlaceholder kind={card.placeholder} />
        )}
        {card.brokerCount > 0 && (
          <BrokersBadge count={card.brokerCount} className={styles.miniBrokers} />
        )}
        <FavoriteButton listingId={card.id} name={card.title} compact className={styles.miniLike} />
      </div>
      <Link href={card.href} className={styles.miniBody} aria-label={`${card.label} 상세 보기`}>
        <DealLabel deal={card.deal} />
        <span className={styles.miniPrice}>
          <b className="price price-sm">{card.price}</b>
          {card.premium !== undefined && (
            <PremiumBadge amount={card.premium} className={styles.miniPrem} />
          )}
        </span>
        <span className={styles.miniName}>
          {card.title}
          {card.subtitle && <span> {card.subtitle}</span>}
        </span>
        {card.meta.length > 0 && (
          <span className={styles.miniMeta}>
            {card.meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </span>
        )}
        <span className={styles.miniGrow} />
        {card.verifiedDate ? (
          <VerifiedBadge date={card.verifiedDate} className={styles.miniVerified} />
        ) : (
          <span className={`${styles.miniVerified} ${styles.unverified}`}>확인일 미등록</span>
        )}
      </Link>
    </article>
  );
}
