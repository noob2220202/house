import 'server-only';
import { ListingSort } from '@house/shared';
import type { z } from 'zod';
import { homeSummarySchema, listingPageSchema } from '@/features/w-home/api/schemas';
import type { QueryParams } from '@/lib/api/config';
import { ApiError } from '@/lib/api/errors';
import { serverGet } from '@/lib/api/server';
import { SEO_REVALIDATE } from '@/lib/seo/api';
import { seoTradeReportSchema } from '@/lib/seo/schemas';
import { toBrandPanelFacts, type BrandPanelFacts } from '../lib/brand-facts';

/**
 * The login panel is decoration, so its facts must never hold the page up: every read has a
 * short timeout, is served from the shared data cache, and a failure only hides its card.
 */
export const BRAND_FACTS_TIMEOUT_MS = 1500;

async function quiet<S extends z.ZodType>(
  path: string,
  schema: S,
  options: { query?: QueryParams; revalidate: number; tags: string[] },
): Promise<z.infer<S> | undefined> {
  try {
    const data: unknown = await serverGet(path, {
      ...options,
      schema,
      timeoutMs: BRAND_FACTS_TIMEOUT_MS,
    });
    return data as z.infer<S>;
  } catch (error) {
    if (error instanceof ApiError) return undefined;
    throw error;
  }
}

/**
 * Real facts of the login brand panel: the newest public listing that passed 실매물 확인 (the
 * same `GET /listings` read as the home strip), else the 국토교통부 실거래 report of the latest
 * month, and the count of approved offices (`GET /home/summary`).
 */
export async function getBrandPanelFacts(): Promise<BrandPanelFacts> {
  const [listings, report, summary] = await Promise.all([
    quiet('/listings', listingPageSchema, {
      query: { sort: ListingSort.VERIFIED, verifiedOnly: true, pageSize: 1 },
      revalidate: 60,
      tags: ['listings'],
    }),
    quiet('/seo/reports/apartment-trades', seoTradeReportSchema, {
      revalidate: SEO_REVALIDATE.report,
      tags: ['seo', 'seo:report'],
    }),
    quiet('/home/summary', homeSummarySchema, { revalidate: 300, tags: ['home'] }),
  ]);
  return toBrandPanelFacts({
    listing: listings?.items[0],
    report,
    agencyCount: summary?.agencyCount,
  });
}
