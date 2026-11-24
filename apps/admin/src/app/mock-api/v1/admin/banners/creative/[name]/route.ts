import { BANNER_SLOT_SPECS } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockGuard } from '@/lib/mock';
import { creativeSvg } from '../../_creatives';
import { bannerState } from '../../_store';

// MOCK-ONLY: stand-in banner images ("<code>-pc.svg" / "<code>-mobile.svg") in the slot's spec size.
// The real backend returns media URLs of the uploaded images instead.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { name } = await ctx.params;
  const m = /^(.+)-(pc|mobile)\.svg$/.exec(name);
  const banner = m ? bannerState().banners.find((b) => b.code === m[1]) : undefined;
  if (!m || !banner?.creative) return new Response('Not Found', { status: 404 });
  const spec = BANNER_SLOT_SPECS[banner.slot];
  const size = m[2] === 'mobile' ? (spec.mobile ?? spec.pc) : spec.pc;
  return new Response(creativeSvg(banner.creative, size.width, size.height), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
