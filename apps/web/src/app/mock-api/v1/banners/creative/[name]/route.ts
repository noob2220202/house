import type { NextRequest } from 'next/server';
import { mockGuard } from '@/lib/mock';
import { BANNERS, creativeSvg } from '../../_fixtures';

// MOCK-ONLY: stand-in banner images ("<key>-pc.svg" / "<key>-mobile.svg"). The real backend returns
// media URLs of the uploaded images instead.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { name } = await ctx.params;
  const m = /^(.+)-(pc|mobile)\.svg$/.exec(name);
  const banner = m ? BANNERS.find((b) => b.key === m[1]) : undefined;
  if (!m || !banner) return new Response('Not Found', { status: 404 });
  return new Response(creativeSvg(banner, m[2] as 'pc' | 'mobile'), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
