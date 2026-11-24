import type { MetadataRoute } from 'next';
import { ROUTES } from '@/config/nav';
import { noticeHref } from '@/features/w-content/notices/NoticeList';
import { collectEntries, staticEntries } from '@/features/w-content/system/sitemap-entries';

// Regenerated hourly (ISR); listing/complex/agency URLs come from the public list endpoints. A failed
// regeneration keeps the previous sitemap (see collectEntries for the error policy).
export const revalidate = 3600;

/** sitemap.xml — static pages + every public listing, complex, broker office and notice. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [listings, complexes, agencies, notices] = await Promise.all([
    collectEntries('/listings', ROUTES.listing, { changeFrequency: 'daily', priority: 0.8 }),
    collectEntries('/complexes', ROUTES.complex, { changeFrequency: 'daily', priority: 0.8 }),
    collectEntries('/agencies', ROUTES.agency, { changeFrequency: 'weekly', priority: 0.6 }),
    collectEntries('/notices', noticeHref, { changeFrequency: 'monthly', priority: 0.3 }),
  ]);
  return [...staticEntries(), ...complexes, ...listings, ...agencies, ...notices];
}
