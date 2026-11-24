import {
  BrokersBadge,
  DealBadge,
  DealLabel,
  Icon,
  PhotoPlaceholder,
  PremiumBadge,
  VerifiedBadge,
} from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import type { AgencyListing } from '../api/schemas';
import { toListingCard } from '../lib/agency';
import styles from './AgencyListingItem.module.css';

export interface AgencyListingItemProps {
  listing: AgencyListing;
  headingLevel?: 3 | 4;
}

/**
 * One listing of the agency page grid, rendered ONCE for every width: a `ListingCard`-style card
 * from 721px (photo · deal caption · big price · name · 평/층/향 · 실매물 확인) and, on phones, the
 * compact row of the MobileMap list (72px thumb · deal tag + price + 중개사 N곳 · name · meta).
 * The switch is pure CSS on the same markup, so there is no hydration shift and no second list.
 * The whole item is one link (stretched from the title).
 */
export function AgencyListingItem({ listing, headingLevel = 3 }: AgencyListingItemProps) {
  const card = toListingCard(listing);
  const Heading: 'h3' | 'h4' = `h${headingLevel}`;
  return (
    <article className={styles.item}>
      <span className={styles.photo}>
        {listing.coverPhotoUrl ? (
          <Image
            src={listing.coverPhotoUrl}
            alt=""
            fill
            sizes="(max-width: 720px) 72px, (max-width: 1080px) 50vw, 300px"
          />
        ) : (
          <PhotoPlaceholder kind={card.placeholder} className={styles.art} />
        )}
        {card.brokerCount !== undefined && (
          <BrokersBadge count={card.brokerCount} className={styles.brokersOnPhoto} />
        )}
      </span>
      <div className={styles.body}>
        <DealLabel deal={card.deal} className={styles.dealCaption} />
        <div className={styles.priceRow}>
          <DealBadge deal={card.deal} className={styles.dealTag} />
          <p className={`price ${styles.price}`}>{card.price}</p>
          {card.premium !== undefined && <PremiumBadge amount={card.premium} />}
          {card.brokerCount !== undefined && (
            <BrokersBadge count={card.brokerCount} light className={styles.brokersInline} />
          )}
        </div>
        <Heading className={styles.name}>
          <Link href={ROUTES.listing(listing.id)} className={styles.link}>
            {card.title}
            {card.subtitle && <span> {card.subtitle}</span>}
          </Link>
        </Heading>
        {card.meta.length > 0 && (
          <p className={styles.meta}>
            {card.meta.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </p>
        )}
      </div>
      <div className={styles.foot}>
        {card.verifiedDate ? (
          <VerifiedBadge date={card.verifiedDate} />
        ) : (
          <span className={styles.unverified}>확인일 미등록</span>
        )}
        {/* Wrapped: Icon sets an inline display, so the row layout hides the wrapper. */}
        <span className={styles.chev}>
          <Icon name="chevron-right" size={18} />
        </span>
      </div>
    </article>
  );
}
