'use client';
import { DealType, DIRECTION_LABEL, ListingSort } from '@house/shared';
import { DealBadge, PremiumBadge, Skeleton } from '@house/ui';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ROUTES } from '@/config/nav';
import { formatCount, formatFloor, formatManwon } from '@/lib/format';
import { complexKeys, fetchComplexListings, fetchNearbyComplexes } from '../api/queries';
import { formatDistance } from '../lib/complex';
import type { ComplexListingItem, NearbyComplex } from '../api/schemas';
import { headlineAmount, pyeongText } from '../lib/listing';
import styles from './panel.module.css';

const QUERY = { dealTypes: [DealType.PRESALE], sort: ListingSort.VERIFIED, pageSize: 2 } as const;

export type NearbyPresaleState =
  | { status: 'pending' }
  | { status: 'none' }
  | { status: 'ready'; target: NearbyComplex; listings: readonly ComplexListingItem[] };

/**
 * Data of the "근처 분양권" strip: the nearest complex with 분양권 listings and its two freshest ones.
 * Called by the panel itself (not by the strip) so both requests start with the panel, in parallel
 * with the listing list — the strip is then ready when the rows are, and never pushes them down.
 */
export function useNearbyPresale(complexId: string): NearbyPresaleState {
  const nearby = useQuery({
    queryKey: complexKeys.nearby(complexId, 10),
    queryFn: ({ signal }) => fetchNearbyComplexes(complexId, 10, signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const target = nearby.data?.find((c) => c.dealCounts.presale > 0);
  const listings = useQuery({
    queryKey: complexKeys.listings(target?.id ?? '', QUERY),
    queryFn: ({ signal }) => fetchComplexListings(target!.id, QUERY, signal),
    enabled: !!target,
    staleTime: 60_000,
    retry: false,
  });
  if (nearby.isPending || (target && listings.isPending)) return { status: 'pending' };
  if (!target || !listings.data || listings.data.items.length === 0) return { status: 'none' };
  return { status: 'ready', target, listings: listings.data.items };
}

/** Holds the strip's height while its data is on the way (rendered only after the first row). */
export function NearbyPresaleSkeleton() {
  return (
    <li className={styles.near} aria-hidden="true">
      <div className={styles.nearH}>
        <Skeleton width={180} height={16} />
      </div>
      <div className={styles.nearSk}>
        <Skeleton width="100%" height={24} />
        <Skeleton width="100%" height={24} />
      </div>
    </li>
  );
}

export interface NearbyPresaleProps {
  target: NearbyComplex;
  listings: readonly ComplexListingItem[];
  /** Href that opens another complex in the panel. */
  complexHref: (id: string) => string;
}

/** "근처 분양권" strip, rendered as an item of the listing list (after the first row, as designed). */
export function NearbyPresale({ target, listings, complexHref }: NearbyPresaleProps) {
  return (
    <li className={styles.near}>
      <div className={styles.nearH}>
        <span>
          <b>근처 분양권</b> · {target.name}
          <span className={styles.nearD}>{formatDistance(target.distanceM)}</span>
        </span>
        <Link className={`link ${styles.nearMore}`} href={complexHref(target.id)}>
          {formatCount(target.dealCounts.presale)}건 보기
        </Link>
      </div>
      <ul className={styles.nearL}>
        {listings.map((l) => {
          const amount = headlineAmount(l);
          const spec = [
            formatFloor({
              totalFloors: l.totalFloors,
              floorClass: l.floorClass ?? undefined,
              showExact: false,
            }),
            pyeongText(l.pyeongLabel),
            l.direction ? DIRECTION_LABEL[l.direction] : '',
          ].filter(Boolean);
          return (
            <li key={l.id}>
              <Link className={styles.nearR} href={ROUTES.listing(l.id)}>
                <DealBadge deal="presale" />
                <span className={styles.nearS}>
                  {l.dong && <b>{l.dong}</b>}
                  {l.dong && spec.length > 0 && ' · '}
                  {spec.join(' · ')}
                </span>
                <span className={styles.nearP}>
                  <b>{amount === null ? '가격 협의' : formatManwon(amount)}</b>
                  {l.premium != null && <PremiumBadge amount={l.premium} />}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </li>
  );
}
