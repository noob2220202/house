import { Button, Icon } from '@house/ui';
import Link from 'next/link';
import type { AgencyListing } from '@/features/w-agencies/api/schemas';
import { AgencyListingCard } from '@/features/w-agencies/components/AgencyListingCard';
import { OFFICE_ROUTES } from '../lib/site';
import styles from './OfficeSite.module.css';

export interface OfficeMoreListingsProps {
  agencyName: string;
  /** Other listings of the office (the current one already left out). */
  items: readonly AgencyListing[];
}

/**
 * "이 사무소의 다른 매물" under a listing of an office's own 홈페이지 — instead of the main site's
 * similar listings, which mix in other offices.
 */
export function OfficeMoreListings({ agencyName, items }: OfficeMoreListingsProps) {
  if (items.length === 0) return null;
  return (
    <section className={styles.more} aria-labelledby="office-more">
      <div className={styles.moreHd}>
        <h2 id="office-more">
          이 사무소의 다른 매물<span className="sr-only"> ({agencyName})</span>
        </h2>
        <Button
          href={OFFICE_ROUTES.listings}
          linkAs={Link}
          variant="ghost"
          size="sm"
          iconRight={<Icon name="chevron-right" size={16} />}
        >
          전체 매물 보기
        </Button>
      </div>
      <ul className={styles.moreGrid}>
        {items.map((l) => (
          <li key={l.id}>
            <AgencyListingCard
              listing={l}
              sizes="(max-width: 720px) 72vw, 300px"
              showBrokerCount={false}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
