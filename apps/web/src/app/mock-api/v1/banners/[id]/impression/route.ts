import type { NextRequest } from 'next/server';
import { mockGuard, mockNotFound } from '@/lib/mock';
import { BANNERS } from '../../_fixtures';

// POST /api/v1/banners/:id/impression — public tracking beacon (deduped per visitor/day server-side).
// Optional body `{ ids: string[] }` batches more banners into the same call. Answers 204.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { id } = await ctx.params;
  if (!BANNERS.some((b) => b.id === id)) return mockNotFound('BANNER_NOT_FOUND');
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
}
