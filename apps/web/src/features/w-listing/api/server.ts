import 'server-only';
import type { z } from 'zod';
import { complexDetailSchema } from '@/features/w-complex/api/schemas';
import { serverGetDetail, serverGetOr } from '@/lib/api/server';
import { withComplexDetail } from '../lib/complex';
import { listingDetailSchema, type ListingDetail } from './schemas';

type ListingDetailWire = z.infer<typeof listingDetailSchema>;

/** GET /listings/:id, cached as an outcome: a listing hidden or deleted later 404s (D-E). */
export function getListing(id: string): Promise<ListingDetailWire | null> {
  return serverGetDetail(`/listings/${encodeURIComponent(id)}`, {
    schema: listingDetailSchema,
    revalidate: 60,
    tags: ['listings', `listing:${id}`],
  });
}

/**
 * Public listing detail with its 단지 facts (best effort), cached like the listing page (60 s /
 * 300 s). Null for 404 (gone / never existed) and 400 (malformed id); other errors throw. Used by
 * the listing page on both the main site and the office site (app/office-site/[slug]/listing/[id]).
 */
export async function getListingDetail(id: string): Promise<ListingDetail | null> {
  const listing = await getListing(id);
  if (!listing) return null;
  const complex = listing.complex
    ? await serverGetOr(`/complexes/${encodeURIComponent(listing.complex.id)}`, null, {
        schema: complexDetailSchema,
        revalidate: 300,
        tags: ['complexes', `complex:${listing.complex.id}`],
      })
    : null;
  return withComplexDetail(listing, complex);
}
