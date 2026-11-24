import type { NextRequest } from 'next/server';
import { mockGuard } from '@/lib/mock';
import { thumbSvg } from '../../_fixtures';

// MOCK-ONLY: stand-in video thumbnails ("V01.svg"). Real thumbnails are YouTube images.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { name } = await ctx.params;
  const svg = thumbSvg(name.replace(/\.svg$/, ''));
  if (!svg) return new Response('Not Found', { status: 404 });
  return new Response(svg, {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
