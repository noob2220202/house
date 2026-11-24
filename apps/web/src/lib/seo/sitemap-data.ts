import 'server-only';
import { z } from 'zod';
import { pageOf } from '@/features/w-content/api/schemas';
import { noticeHref } from '@/features/w-content/notices/NoticeList';
import { POLICY_DOCS, policyHref } from '@/features/w-content/terms/policies';
import { ROUTES } from '@/config/nav';
import { serverGet } from '@/lib/api/server';
import { getSeoRegionIndex, getSitemapRows, getTradeReport } from './api';
import { absoluteUrl } from './metadata';
import {
  regionEntries,
  reportEntries,
  rowEntries,
  staticEntries,
  type SitemapEntry,
  type SitemapFile,
} from './sitemap';

/*
 * Data of each sitemap file. Every file is rendered per request (`connection()` in the route) with
 * the API reads in the Next data cache (≤ 15 min): an API failure answers 5xx — crawlers retry —
 * instead of a short sitemap that would drop URLs from the index.
 */

const noticeRows = pageOf(
  z.object({
    id: z.string(),
    updatedAt: z.string().nullable().optional(),
    publishedAt: z.string().nullable().optional(),
  }),
);

/** 공지사항 (paginated public list, ≤ 20 pages × 100). */
async function noticeEntries(): Promise<SitemapEntry[]> {
  const out: SitemapEntry[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await serverGet('/notices', {
      query: { page, pageSize: 100 },
      schema: noticeRows,
      revalidate: 3600,
      tags: ['sitemap'],
      timeoutMs: 8000,
    });
    for (const row of result.items) {
      const modified = row.updatedAt ?? row.publishedAt;
      const date = modified ? new Date(modified) : undefined;
      out.push({
        url: absoluteUrl(noticeHref(row.id)),
        lastModified: date && !Number.isNaN(date.getTime()) ? date : undefined,
        changeFrequency: 'monthly',
        priority: 0.3,
      });
    }
    if (page >= result.totalPages || result.items.length === 0) break;
  }
  return out;
}

export async function sitemapEntries(file: SitemapFile): Promise<SitemapEntry[]> {
  switch (file) {
    case 'static': {
      const [notices, report] = await Promise.all([noticeEntries(), getTradeReport()]);
      return [
        ...staticEntries(POLICY_DOCS.map((d) => policyHref(d.slug))),
        ...reportEntries(report),
        ...notices,
      ];
    }
    case 'regions':
      return regionEntries(await getSeoRegionIndex());
    case 'complexes':
      return rowEntries(await getSitemapRows('complexes'), ROUTES.complex, {
        changeFrequency: 'daily',
        priority: 0.8,
      });
    case 'listings':
      return rowEntries(await getSitemapRows('listings'), ROUTES.listing, {
        changeFrequency: 'daily',
        priority: 0.6,
      });
    case 'agencies':
      return rowEntries(await getSitemapRows('agencies'), ROUTES.agency, {
        changeFrequency: 'weekly',
        priority: 0.5,
      });
  }
}
