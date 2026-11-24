import { DEAL_TYPE_LABEL } from '@house/shared';
import { DealBadge, PhotoPlaceholder, cx, dealKindOf, photoKindForAsset } from '@house/ui';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { formatDealPrice, formatPyeong, formatSqm } from '@/lib/format';
import type { InboxListing } from '../api/schemas';
import styles from './ListingMini.module.css';

export function listingPriceText(l: InboxListing): string {
  return formatDealPrice({
    dealType: l.dealType,
    price: l.price,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
  });
}

/** "전용 84.98㎡ (26평) · 고/25층" */
export function listingSpecText(l: InboxListing): string {
  return [
    typeof l.exclusiveArea === 'number'
      ? `전용 ${formatSqm(l.exclusiveArea)} (${formatPyeong(l.exclusiveArea)})`
      : null,
    l.floorLabel,
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface ListingMiniProps {
  listing: InboxListing;
  /** Extra line under the specs (match reasons …). */
  note?: ReactNode;
  /** Right-most slot (remove button, checkbox …). */
  end?: ReactNode;
  className?: string;
}

/** Compact listing row: thumbnail · title + specs · deal badge + price. Presentational. */
export function ListingMini({ listing: l, note, end, className }: ListingMiniProps) {
  return (
    <span className={cx(styles.row, className)}>
      <span className={styles.thumb}>
        {l.thumbUrl ? (
          <Image src={l.thumbUrl} alt="" fill sizes="52px" />
        ) : (
          <PhotoPlaceholder kind={photoKindForAsset(l.assetType)} />
        )}
      </span>
      <span className={styles.text}>
        <b>{l.title}</b>
        <span>{listingSpecText(l)}</span>
        {note}
      </span>
      <span className={styles.price}>
        <DealBadge deal={dealKindOf(l.dealType)}>{DEAL_TYPE_LABEL[l.dealType]}</DealBadge>
        <span>{listingPriceText(l)}</span>
      </span>
      {end}
    </span>
  );
}
