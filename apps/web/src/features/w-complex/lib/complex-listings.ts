import type { QueryParams } from '@/lib/api';
import type { ComplexListingQuery } from '../api/queries';
import type { ComplexListingItem, ComplexListings, ComplexListingSummary } from '../api/schemas';

/** Rows fetched in one go for the 동 filter / 동 list (more than any 단지 here lists at once). */
export const COMPLEX_LIST_WINDOW = 100;

type ListingPage = { items: ComplexListingItem[]; total: number };
export interface ComplexListingsSource {
  /** `GET /listings` with the given query. */
  page: (query: QueryParams) => Promise<ListingPage>;
  /** `GET /complexes/:id/listings` (ComplexListingsSummary). */
  summary: () => Promise<ComplexListingSummary>;
}

const EMPTY_SUMMARY: ComplexListingSummary = { total: 0, byDealType: [], dongs: [] };

/** Distinct 동 names of the rows, in natural order ("101동" < "103동" < "1201동"). */
export function dongsOf(items: readonly { dong?: string | null }[]): string[] {
  const set = new Set(items.flatMap((l) => (l.dong ? [l.dong] : [])));
  return [...set].sort((a, b) => a.localeCompare(b, 'ko', { numeric: true }));
}

/**
 * One page of a complex's listings: the first `COMPLEX_LIST_WINDOW` rows of `GET /listings`
 * (complexId + filters) give the 동 list and serve the 동 filter and small complexes locally;
 * bigger unfiltered lists page on the server. The summary comes from `GET /complexes/:id/listings`.
 */
export async function loadComplexListings(
  id: string,
  q: ComplexListingQuery,
  source: ComplexListingsSource,
): Promise<ComplexListings> {
  const { dong, page = 1, pageSize = 20, ...filters } = q;
  const base = { ...filters, complexId: id } as QueryParams;
  const [head, summary] = await Promise.all([
    source.page({ ...base, page: 1, pageSize: COMPLEX_LIST_WINDOW }),
    source.summary().catch(() => EMPTY_SUMMARY),
  ]);
  const withDongs = { ...summary, dongs: dongsOf(head.items) };
  const local = (rows: ComplexListingItem[]): ComplexListings => {
    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
    const at = Math.min(Math.max(1, page), totalPages);
    return {
      items: rows.slice((at - 1) * pageSize, at * pageSize),
      page: at,
      pageSize,
      total: rows.length,
      totalPages,
      summary: withDongs,
    };
  };
  if (dong) return local(head.items.filter((l) => l.dong === dong));
  if (head.total <= head.items.length) return local(head.items);
  const remote = await source.page({ ...base, page, pageSize });
  return {
    items: remote.items,
    page,
    pageSize,
    total: remote.total,
    totalPages: Math.max(1, Math.ceil(remote.total / pageSize)),
    summary: withDongs,
  };
}
