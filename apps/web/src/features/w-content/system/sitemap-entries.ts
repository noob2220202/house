import 'server-only';
import type { MetadataRoute } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import { z } from 'zod';
import { ROUTES, type MapAssetSlug } from '@/config/nav';
import { ApiError } from '@/lib/api/errors';
import { serverGet } from '@/lib/api/server';
import { absoluteUrl } from '@/lib/seo';
import { pageOf } from '../api/schemas';
import { POLICY_DOCS, policyHref } from '../terms/policies';

type Entry = MetadataRoute.Sitemap[number];

const MAP_ASSETS: readonly MapAssetSlug[] = ['apt', 'oneroom', 'house', 'commercial', 'land'];

/** Pages that always exist. No `lastModified`: we do not know when they last changed. */
export function staticEntries(): Entry[] {
  const entry = (
    path: string,
    changeFrequency: Entry['changeFrequency'],
    priority: number,
  ): Entry => ({ url: absoluteUrl(path), changeFrequency, priority });
  return [
    entry(ROUTES.home, 'hourly', 1),
    ...MAP_ASSETS.map((asset) => entry(ROUTES.map(asset), 'hourly', 0.9)),
    entry(ROUTES.agencies, 'daily', 0.8),
    entry(ROUTES.deal, 'monthly', 0.7),
    entry(ROUTES.community, 'daily', 0.6),
    entry(ROUTES.videos, 'weekly', 0.6),
    entry(ROUTES.tools, 'monthly', 0.6),
    entry(ROUTES.notices, 'weekly', 0.5),
    entry(ROUTES.faq, 'monthly', 0.5),
    entry(ROUTES.support, 'monthly', 0.4),
    ...POLICY_DOCS.map((doc) => entry(policyHref(doc.slug), 'yearly', 0.3)),
  ];
}

/** Minimal row every public list endpoint is expected to expose. */
const rowSchema = z.object({
  id: z.string(),
  updatedAt: z.string().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
});
const rowsSchema = pageOf(rowSchema);

const PAGE_SIZE = 100;
/** Safety cap per resource (Google allows 50,000 URLs per sitemap file). */
const MAX_PAGES = 50;

/** `next build` has no API to talk to; at runtime a failure must not produce a short sitemap. */
const isBuildPhase = (): boolean => process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD;

/**
 * Walks a paginated public list endpoint and maps every row to a sitemap entry.
 *
 * Failure policy: during `next build` (no backend) an API error just yields no URLs for that
 * resource. At runtime any error is rethrown, so the ISR regeneration fails as a whole and Next keeps
 * serving the last complete sitemap (and retries on the next request after `revalidate`) instead of
 * caching a truncated one for an hour.
 */
export async function collectEntries(
  apiPath: string,
  toPath: (id: string) => string,
  options: { changeFrequency: Entry['changeFrequency']; priority: number },
): Promise<Entry[]> {
  const out: Entry[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await serverGet(apiPath, {
        query: { page, pageSize: PAGE_SIZE },
        schema: rowsSchema,
        revalidate: 3600,
        tags: ['sitemap'],
        timeoutMs: 8000,
      });
      for (const row of result.items) {
        const modified = row.updatedAt ?? row.publishedAt;
        const date = modified ? new Date(modified) : undefined;
        out.push({
          url: absoluteUrl(toPath(row.id)),
          lastModified: date && !Number.isNaN(date.getTime()) ? date : undefined,
          ...options,
        });
      }
      if (page >= result.totalPages || result.items.length === 0) break;
    }
  } catch (error) {
    if (!(error instanceof ApiError) || !isBuildPhase()) throw error;
    console.warn(`[sitemap] ${apiPath}: API unavailable during build (${error.code}) — 0 URLs`);
    return [];
  }
  return out;
}
