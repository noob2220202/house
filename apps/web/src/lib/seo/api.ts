import 'server-only';
import type { AssetType } from '@house/shared';
import { cache } from 'react';
import { ApiError } from '@/lib/api/errors';
import { serverGet } from '@/lib/api/server';
import {
  seoListingStatusSchema,
  seoRegionIndexSchema,
  seoRegionLandingSchema,
  seoSitemapSchema,
  seoTradeReportSchema,
  type SeoListingStatus,
  type SeoRegionIndex,
  type SeoRegionLanding,
  type SeoSitemap,
  type SeoSitemapKind,
  type SeoTradeReport,
} from './schemas';

/** ISR / data-cache windows (seconds) — the API caches the same data for 10 min / 1 h. */
export const SEO_REVALIDATE = { regions: 600, report: 3600, sitemap: 900 } as const;

const notFoundToNull = async <T>(load: () => Promise<T>): Promise<T | null> => {
  try {
    return await load();
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.status === 400)) return null;
    throw error;
  }
};

/** GET /seo/regions — every 지역 with data. Throws when the API is unreachable. */
export const getSeoRegionIndex = cache(
  (): Promise<SeoRegionIndex> =>
    serverGet('/seo/regions', {
      schema: seoRegionIndexSchema,
      revalidate: SEO_REVALIDATE.regions,
      tags: ['seo', 'seo:regions'],
      timeoutMs: 8000,
    }),
);

/** GET /seo/regions/:code/landing — null for an unknown region. */
export const getRegionLanding = cache(
  (code: string, assetTypes: readonly AssetType[]): Promise<SeoRegionLanding | null> =>
    notFoundToNull(() =>
      serverGet(`/seo/regions/${encodeURIComponent(code)}/landing`, {
        query: { assetTypes: [...assetTypes] },
        schema: seoRegionLandingSchema,
        revalidate: SEO_REVALIDATE.regions,
        tags: ['seo', 'listings', 'complexes'],
        timeoutMs: 8000,
      }),
    ),
);

/** GET /seo/reports/apartment-trades?ym — null when there is no data for the month. */
export const getTradeReport = cache(
  (ym?: number): Promise<SeoTradeReport | null> =>
    notFoundToNull(() =>
      serverGet('/seo/reports/apartment-trades', {
        query: { ym },
        schema: seoTradeReportSchema,
        revalidate: SEO_REVALIDATE.report,
        tags: ['seo', 'seo:report'],
        timeoutMs: 8000,
      }),
    ),
);

/** GET /seo/sitemap/:kind — throws on failure (a sitemap must never be silently short). */
export function getSitemapRows(kind: SeoSitemapKind): Promise<SeoSitemap> {
  return serverGet(`/seo/sitemap/${kind}`, {
    schema: seoSitemapSchema,
    revalidate: SEO_REVALIDATE.sitemap,
    tags: ['seo', 'sitemap'],
    timeoutMs: 10_000,
  });
}

/**
 * GET /seo/listings/:id/status — where a listing URL that is no longer public should lead.
 * Best effort: null when unknown or when the API fails (the page then answers 404).
 */
export async function getListingStatus(id: string): Promise<SeoListingStatus | null> {
  try {
    return await serverGet(`/seo/listings/${encodeURIComponent(id)}/status`, {
      schema: seoListingStatusSchema,
      revalidate: 300,
      tags: ['listings', `listing:${id}`],
      timeoutMs: 4000,
    });
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}
