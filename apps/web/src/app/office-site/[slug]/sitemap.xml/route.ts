import { loadOfficeSite } from '@/features/w-site/api/server';
import { officeHomeUrl } from '@/features/w-site/lib/site';

type Ctx = { params: Promise<{ slug: string }> };

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * sitemap.xml of an office host: the home only. Its listing pages are duplicates of the main site's
 * (canonical there), so they are listed by the main sitemaps, not here.
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const site = await loadOfficeSite(slug);
  if (!site) return new Response('Not Found', { status: 404 });
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${escapeXml(officeHomeUrl(site))}</loc><changefreq>daily</changefreq></url>
</urlset>
`;
  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}
