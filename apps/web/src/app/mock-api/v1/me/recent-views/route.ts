import type { NextRequest } from 'next/server';
import { mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { findMeListing } from '../_lookup';
import { meGuard, mockForcedFailure } from '../_store';

// GET /api/v1/me/recent-views?targetType=LISTING&page&pageSize — 최근 본 매물, newest first.
// The mock only tracks listings (RecentViewTarget.LISTING); other target types return an empty page.
export async function GET(req: NextRequest) {
  const g = meGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req);
  const forced = mockForcedFailure(req);
  if (forced) return forced;
  const targetType = req.nextUrl.searchParams.get('targetType') ?? 'LISTING';
  const favorites = new Set(g.state.favoriteListings.map((f) => f.id));
  const rows =
    targetType === 'LISTING'
      ? g.state.recentViews.map((view) => {
          const listing = findMeListing(view.id);
          return {
            targetType: 'LISTING' as const,
            targetId: view.id,
            viewedAt: view.at,
            listing: listing ? { ...listing, isFavorite: favorites.has(listing.id) } : null,
          };
        })
      : [];
  return mockJson(mockPaginate(rows, req, { pageSize: 20 }));
}
