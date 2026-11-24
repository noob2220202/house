import type { NextRequest } from 'next/server';
import { mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { toListingWire } from '../../../listings/_summary';
import { findMeListing } from '../../_lookup';
import { meGuard, mockForcedFailure } from '../../_store';

// GET /api/v1/me/favorites/listings?page&pageSize — 관심 매물, newest first.
// Items = `FavoriteListingItem` { favoritedAt, listing: ListingSummary } (listings module).
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  const rows = g.state.favoriteListings.flatMap((fav) => {
    const listing = findMeListing(fav.id);
    return listing ? [{ favoritedAt: fav.at, listing: toListingWire(listing) }] : [];
  });
  return mockJson(mockPaginate(rows, req, { pageSize: 20 }));
}
