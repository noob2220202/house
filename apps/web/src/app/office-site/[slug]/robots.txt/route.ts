import { env } from '@/config/env';
import { loadOfficeSite } from '@/features/w-site/api/server';
import { officeHomeUrl } from '@/features/w-site/lib/site';

type Ctx = { params: Promise<{ slug: string }> };

const text = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });

/**
 * robots.txt of an office host: everything may be crawled (listing pages point their canonical at
 * the main site) and the office's own sitemap. A mock-mode deployment is never indexable.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const site = await loadOfficeSite(slug);
  if (!site) return text('Not Found', 404);
  if (env.apiMock) return text('User-agent: *\nDisallow: /\n');
  return text(`User-agent: *\nAllow: /\n\nSitemap: ${officeHomeUrl(site)}sitemap.xml\n`);
}
