import type { NextRequest } from 'next/server';
import { mockGuard } from '@/lib/mock';
import { POPUPS, popupSvg } from '../../_fixtures';

// MOCK-ONLY: stand-in popup images ("<key>.svg"). The real backend returns the uploaded media URL.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ name: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { name } = await ctx.params;
  const popup = POPUPS.find((p) => `${p.key}.svg` === name);
  if (!popup) return new Response('Not Found', { status: 404 });
  return new Response(popupSvg(popup), {
    headers: {
      'content-type': 'image/svg+xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
