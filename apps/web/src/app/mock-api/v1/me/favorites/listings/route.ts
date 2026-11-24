import type { NextRequest } from 'next/server';
import { mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { findMeListing } from '../../_lookup';
import { meGuard, mockForcedFailure } from '../../_store';

// GET /api/v1/me/favorites/listings?page&pageSize — 관심 매물, newest first.
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  const rows = g.state.favoriteListings.flatMap((fav) => {
    const listing = findMeListing(fav.id);
    return listing ? [{ ...listing, isFavorite: true, favoritedAt: fav.at }] : [];
  });
  return mockJson(mockPaginate(rows, req, { pageSize: 20 }));
}
