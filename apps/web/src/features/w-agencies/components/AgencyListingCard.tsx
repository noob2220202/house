import { ListingCard } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import type { AgencyListing } from '../api/schemas';
import { toListingCard } from '../lib/agency';

export interface AgencyListingCardProps {
  listing: AgencyListing;
  headingLevel?: 2 | 3 | 4;
  sizes?: string;
  /** "중개사 N곳" when co-brokered (default). Off on the office's own site, which names only it. */
  showBrokerCount?: boolean;
}

/** `ListingCard` for an office's listing (photo from the media URL, placeholder art otherwise). */
export function AgencyListingCard({
  listing,
  headingLevel = 3,
  sizes = '(max-width: 720px) 100vw, (max-width: 1080px) 50vw, 300px',
  showBrokerCount = true,
}: AgencyListingCardProps) {
  const card = toListingCard(listing);
  return (
    <ListingCard
      href={ROUTES.listing(listing.id)}
      linkAs={Link}
      deal={card.deal}
      price={card.price}
      premium={card.premium}
      title={card.title}
      subtitle={card.subtitle}
      meta={card.meta}
      verifiedDate={card.verifiedDate}
      brokerCount={showBrokerCount ? card.brokerCount : undefined}
      placeholder={card.placeholder}
      headingLevel={headingLevel}
      media={
        listing.coverPhotoUrl ? (
          <Image
            src={listing.coverPhotoUrl}
            alt={`${card.title} 사진`}
            fill
            sizes={sizes}
            style={{ objectFit: 'cover' }}
          />
        ) : undefined
      }
    />
  );
}
