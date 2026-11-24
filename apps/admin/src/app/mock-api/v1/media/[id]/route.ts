import type { NextRequest } from 'next/server';
import { mockError, mockGuard, mockJson } from '@/lib/mock';
import { mediaDto } from '../../admin/media/_store';

// GET /api/v1/media/:id — metadata + variant URLs of a (public) media object (media README).
// m-ads polls it after an upload while the variants are still being generated; the mock store has
// them right away, so here it simply answers with the stored object.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const media = mediaDto((await ctx.params).id);
  return media ? mockJson(media) : mockError(404, 'MEDIA_NOT_FOUND', '파일을 찾을 수 없습니다.');
}
