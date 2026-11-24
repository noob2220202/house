import type { NextRequest } from 'next/server';
import { mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { toListingWire } from '../../listings/_summary';
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
  const rows =
    targetType === 'LISTING'
      ? g.state.recentViews.map((view) => {
          const listing = findMeListing(view.id);
          // RecentViewItem: `listing` is left out when the listing is gone (backend: optional).
          return {
            targetType: 'LISTING' as const,
            targetId: view.id,
            viewedAt: view.at,
            ...(listing
              ? { listing: toListingWire(listing) }
              : {}),
          };
        })
      : [];
  return mockJson(mockPaginate(rows, req, { pageSize: 20 }));
}
