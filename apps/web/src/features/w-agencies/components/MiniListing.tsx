import { DEAL_KIND_LABEL, DealBadge, PhotoPlaceholder } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import type { AgencyListing } from '../api/schemas';
import { toListingCard } from '../lib/agency';
import styles from './office.module.css';

/** Compact 대표 매물 tile of the profile drawer (`.mini`): photo + deal tag, price, name, 평·층. */
export function MiniListing({ listing }: { listing: AgencyListing }) {
  const card = toListingCard(listing);
  return (
    <Link className={styles.mini} href={ROUTES.listing(listing.id)}>
      <span className={styles.miniPhoto}>
        {listing.coverPhotoUrl ? (
          <Image src={listing.coverPhotoUrl} alt="" fill sizes="(max-width: 720px) 33vw, 120px" />
        ) : (
          <PhotoPlaceholder kind={card.placeholder} />
        )}
        <DealBadge deal={card.deal} solid className={styles.miniDeal}>
          {card.deal === 'presale' ? '분양' : DEAL_KIND_LABEL[card.deal]}
        </DealBadge>
      </span>
      <span className={styles.miniBody}>
        <b className={styles.miniPrice}>{card.price}</b>
        <span className={styles.miniName}>{card.title}</span>
        {card.meta.length > 0 && (
          <span className={styles.miniMeta}>{card.meta.slice(0, 2).join(' · ')}</span>
        )}
      </span>
    </Link>
  );
}
