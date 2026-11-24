import { NextResponse, type NextRequest } from 'next/server';
import { mockGuard } from '@/lib/mock';
import { getMedia } from '../../_store';

// MOCK ONLY: serves the bytes of an upload (the real backend serves /media/* through nginx).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { id } = await ctx.params;
  const media = getMedia(id);
  if (!media?.bytes) return new NextResponse('Not Found', { status: 404 });
  return new NextResponse(Buffer.from(media.bytes), {
    headers: {
      'content-type': media.mimeType,
      'cache-control': 'private, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
}
