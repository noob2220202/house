import { NextResponse, type NextRequest } from 'next/server';
import { SVG_HEADERS, mockPhotoSvg } from '@/features/m-moderation/mock/art';
import { mockGuard, mockNotFound } from '@/lib/mock';
import { listingsDb } from '../../../_fixtures';

// Mock-only stand-in for listing photos (the real URLs are backend media URLs under /media).
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; index: string }> },
) {
  const off = mockGuard();
  if (off) return off;
  const { id, index } = await ctx.params;
  const listing = listingsDb().find((l) => l.id === id);
  const i = Number(index);
  if (!listing || !Number.isInteger(i) || i < 0 || i >= listing.photoCount) return mockNotFound();
  const seed = Number(id.slice(-4)) * 7 + i;
  const interior = i > 0 && listing.assetType !== 'LAND';
  return new NextResponse(
    mockPhotoSvg(seed, interior ? 'interior' : 'exterior', `견본 사진 ${i + 1}`),
    {
      headers: SVG_HEADERS,
    },
  );
}
