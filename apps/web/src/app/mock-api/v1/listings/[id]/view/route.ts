import type { NextRequest } from 'next/server';
import { mockGuard, mockNotFound, mockSessionRole } from '@/lib/mock';
import { meState } from '../../../me/_store';
import { findMockListingDetail } from '../../_detail-fixtures';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/v1/listings/:id/view — ASSUMED endpoint (docs/frontend-integration/w-listing.md):
// counts a view (deduped server-side) and, for signed-in users, records the recent view.
// Public and CSRF-exempt like the banner impression beacon. Answers 204.
export async function POST(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  const { id } = await ctx.params;
  if (!findMockListingDetail(id))
    return mockNotFound('LISTING_NOT_FOUND', '매물을 찾을 수 없습니다.');
  const role = mockSessionRole(req);
  if (role) {
    const state = meState(role);
    state.recentViews = [
      { id, at: new Date().toISOString() },
      ...state.recentViews.filter((v) => v.id !== id),
    ].slice(0, 50);
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
