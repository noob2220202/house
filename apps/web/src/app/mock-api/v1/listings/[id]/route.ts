import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { findMockListingDetail } from '../_detail-fixtures';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/:id — public listing detail (listings module). Only ACTIVE / RESERVED
// listings are visible; 호수 and owner contact are never part of the payload.
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 60);
  const { id } = await ctx.params;
  const listing = findMockListingDetail(id);
  if (!listing) return mockNotFound('LISTING_NOT_FOUND', '매물을 찾을 수 없습니다.');
  return mockJson(listing);
}
