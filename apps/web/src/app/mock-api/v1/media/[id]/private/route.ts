import type { NextRequest } from 'next/server';
import { mockGuard, mockNotFound, mockSessionRole, mockUnauthenticated } from '@/lib/mock';
import { mediaStore } from '../../_store';

/**
 * GET /api/v1/media/:id/private — authorized stream of a private file (agency documents).
 * Added by a-agency. The real API allows the owning agency's members and admins only; the mock
 * allows any signed-in session.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockGuard();
  if (off) return off;
  if (!mockSessionRole(req)) return mockUnauthenticated();
  const { id } = await ctx.params;
  const media = mediaStore().get(id);
  if (!media) return mockNotFound('MEDIA_NOT_FOUND', '파일을 찾을 수 없습니다.');
  return new Response(new Blob([media.bytes as BlobPart], { type: media.mimeType }), {
    headers: {
      'content-type': media.mimeType,
      'content-disposition': 'inline',
      'cache-control': 'private, no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
