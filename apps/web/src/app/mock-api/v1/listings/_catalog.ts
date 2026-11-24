import type { ListingSummary } from '@/lib/api/schemas/listing';
import { findAgencyListingById } from '../agencies/_fixtures';
import { LISTINGS as MAP_LISTINGS } from '../map/_fixtures';
import { LISTING_ITEMS } from './_list-fixtures';
import { toListingSummary } from './_summary';

/**
 * Lookup of a listing card by id across every mock that serves listing cards (home sample, map
 * inventory, agency pages). Used where another mock must accept any card id: the listing detail
 * fallback (`_detail-fixtures.ts`) and the my-page favourites / recent views.
 */
export interface MockSummaryHit {
  listing: ListingSummary;
  /** 법정동코드, when the source fixture knows it. */
  emdCode?: string;
  /** Agency-page listings: key of the advertising office ("B01"). */
  officeKey?: string;
}

export function findMockListingSummary(id: string): MockSummaryHit | undefined {
  const item = LISTING_ITEMS.find((l) => l.id === id);
  if (item) return { listing: toListingSummary(item), emdCode: item.emdCode };
  const onMap = MAP_LISTINGS.find((l) => l.id === id);
  if (onMap) return { listing: toListingSummary(onMap), emdCode: onMap.emdCode };
  const ofAgency = findAgencyListingById(id);
  if (ofAgency) return { listing: ofAgency.listing, officeKey: ofAgency.officeKey };
  return undefined;
}
