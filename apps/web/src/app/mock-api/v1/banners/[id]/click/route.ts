import { isSafeLinkUrl } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { mockGuard, mockNotFound } from '@/lib/mock';
import { BANNERS, isLive } from '../../_fixtures';

// GET /api/v1/banners/:id/click → 302 to the stored link (counts the click; open-redirect safe:
// only the URL stored by the admin is used, never a query parameter).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const { id } = await ctx.params;
  const banner = BANNERS.find((b) => b.id === id);
  // `/\host` is protocol-relative for browsers although `isSafeLinkUrl` calls it relative.
  // eslint-disable-next-line no-control-regex
  const unsafe = (url: string) => /[\\\u0000-\u001f\u007f]/.test(url) || !isSafeLinkUrl(url);
  if (!banner || !isLive(banner) || !banner.linkUrl || unsafe(banner.linkUrl)) {
    return mockNotFound('BANNER_NOT_FOUND');
  }
  const target = banner.linkUrl.startsWith('/')
    ? new URL(banner.linkUrl, req.nextUrl.origin)
    : new URL(banner.linkUrl);
  return NextResponse.redirect(target, { status: 302, headers: { 'cache-control': 'no-store' } });
}
