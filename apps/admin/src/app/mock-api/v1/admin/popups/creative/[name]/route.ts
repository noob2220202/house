import type { NextRequest } from 'next/server';
import { mockGuard } from '@/lib/mock';
import { creativeSvg } from '../../../banners/_creatives';
import { POPUP_IMAGE, popupState } from '../../_store';

// MOCK-ONLY: stand-in popup image ("<code>.svg", 760 × 600). The real backend returns the media URL.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { name } = await ctx.params;
  const popup = popupState().popups.find((p) => `${p.code}.svg` === name);
  if (!popup?.creative) return new Response('Not Found', { status: 404 });
  return new Response(creativeSvg(popup.creative, POPUP_IMAGE.width, POPUP_IMAGE.height), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
