import { DealLabel, Icon, PhotoPlaceholder, cx } from '@house/ui';
import Image from 'next/image';
import Link from 'next/link';
import { toListingCardModel } from '../lib/listing-card';
import type { ListingSummary } from '../schemas';
import styles from './ListingMiniRow.module.css';

export interface ListingMiniRowProps {
  listing: ListingSummary;
  /** Trailing caption, e.g. "12분 전". */
  trailing?: string;
  className?: string;
}

/** Compact listing row (thumbnail · deal + price · name · facts) for side lists. */
export function ListingMiniRow({ listing, trailing, className }: ListingMiniRowProps) {
  const m = toListingCardModel(listing);
  return (
    <Link href={m.href} className={cx(styles.row, className)}>
      <span className={cx(styles.thumb, m.inactiveLabel && styles.dim)}>
        {m.photoUrl ? (
          <Image src={m.photoUrl} alt="" fill sizes="64px" />
        ) : (
          <PhotoPlaceholder kind={m.placeholder} />
        )}
      </span>
      <span className={styles.main}>
        <span className={styles.top}>
          <DealLabel deal={m.deal}>{m.dealLabel}</DealLabel>
          <b className={cx('num', styles.price)}>{m.price}</b>
          {m.inactiveLabel && <span className={styles.state}>{m.inactiveLabel}</span>}
        </span>
        <span className={styles.name}>
          {m.title}
          {m.subtitle && <span> {m.subtitle}</span>}
        </span>
        <span className={styles.meta}>{m.meta.join(' · ')}</span>
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
      <Icon name="chevron-right" size={18} className={styles.chev} />
    </Link>
  );
}
