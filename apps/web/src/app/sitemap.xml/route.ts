import { connection } from 'next/server';
import { SITEMAP_FILES, newestOf, sitemapFilePath, sitemapIndexXml } from '@/lib/seo/sitemap';
import { sitemapEntries } from '@/lib/seo/sitemap-data';

/**
 * /sitemap.xml — sitemap index (robots.txt points here): one file per page kind, each with the
 * newest `lastmod` of its URLs. A file whose data cannot be read is still listed (without
 * lastmod); the file itself then answers 5xx so crawlers retry it.
 */
export async function GET() {
  await connection();
  const files = await Promise.all(
    SITEMAP_FILES.map(async (name) => ({
      path: sitemapFilePath(name),
      lastModified: await sitemapEntries(name)
        .then(newestOf)
        .catch(() => null),
    })),
  );
  return new Response(sitemapIndexXml(files), {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
    },
  });
}
