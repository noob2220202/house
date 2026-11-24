import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { findMockSimilar } from '../../_detail-fixtures';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/:id/similar — ASSUMED endpoint (docs/frontend-integration/w-listing.md):
// similar listings grouped by 같은 단지 / 같은 평형 / 같은 가격대, each with a total and the first cards.
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 60);
  const { id } = await ctx.params;
  const similar = findMockSimilar(id);
  if (!similar) return mockNotFound('LISTING_NOT_FOUND', '매물을 찾을 수 없습니다.');
  return mockJson(similar);
}
