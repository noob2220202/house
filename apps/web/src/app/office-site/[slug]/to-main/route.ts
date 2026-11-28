import type { NextRequest } from 'next/server';
import { TO_MAIN_HEADER, mainSiteUrl } from '@/features/w-site/lib/host';
import { safeReturnTo } from '@/lib/auth/paths';

/**
 * 307 from an office host to the same path on the main site, for the one setup where the
 * middleware cannot redirect itself: in dev the main site is this server's own origin, and Next
 * rewrites such a middleware Location into a relative one (→ a loop on the office host). The path
 * comes from the middleware (request header); only a site-relative path is accepted.
 */
export function GET(req: NextRequest) {
  const to = safeReturnTo(req.headers.get(TO_MAIN_HEADER), '/');
  return new Response(null, {
    status: 307,
    headers: { location: mainSiteUrl(to), 'cache-control': 'no-store' },
  });
}
