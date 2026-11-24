import { NextResponse, type NextRequest } from 'next/server';
import { mockGuard } from '@/lib/mock';
import { getMedia, isPrivateMedia } from '../../_store';

// MOCK ONLY: serves the bytes of a PUBLIC upload (the real backend serves /media/* through nginx).
// Private media (agency documents) is only streamed by GET /media/:id/private.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { id } = await ctx.params;
  const media = getMedia(id);
  if (!media || isPrivateMedia(media)) return new NextResponse('Not Found', { status: 404 });
  return new NextResponse(Buffer.from(media.bytes), {
    headers: {
      'content-type': media.mimeType,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
}
