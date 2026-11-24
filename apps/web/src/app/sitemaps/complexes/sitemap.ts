import type { MetadataRoute } from 'next';
import { connection } from 'next/server';
import { sitemapEntries } from '@/lib/seo/sitemap-data';

/** /sitemaps/complexes/sitemap.xml — listed in the sitemap index (/sitemap.xml). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return sitemapEntries('complexes');
}
