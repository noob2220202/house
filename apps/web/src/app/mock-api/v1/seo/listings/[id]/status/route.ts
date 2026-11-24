import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { mockListingStatus } from '../../../_data';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/seo/listings/:id/status — public (seo module): PUBLIC / GONE of a published listing.
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 40);
  const { id } = await ctx.params;
  const status = mockListingStatus(id);
  if (!status) return mockNotFound('LISTING_NOT_FOUND', '매물을 찾을 수 없습니다.');
  return mockJson(status);
}
