import 'server-only';
import { BannerSlot, ListingSort } from '@house/shared';
import type { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { serverGet } from '@/lib/api/server';
import type { QueryParams } from '@/lib/api/config';
import { HOME_LIMITS, categoryOf } from '../config';
import {
  agencyPageSchema,
  appSettingsSchema,
  bannerListSchema,
  homeSummarySchema,
  listingPageSchema,
  popularComplexListSchema,
  videoPageSchema,
  type AgencyItem,
  type Banner,
  type HomeSummary,
  type ListingPage,
  type PopularComplex,
  type VideoItem,
} from './schemas';

/**
 * Server-side data for the home page. Every block is fetched independently and NEVER throws:
 * `undefined` means "the API failed" (the block falls back to a client fetch with its own
 * error/retry state, or is left out), so one broken endpoint cannot take the whole page down —
 * and `next build` works without a running backend.
 */
async function safe<S extends z.ZodType>(
  path: string,
  schema: S,
  options: { query?: QueryParams; revalidate: number; tags: string[] },
): Promise<z.infer<S> | undefined> {
  try {
    const data: unknown = await serverGet(path, { ...options, schema, timeoutMs: 5000 });
    return data as z.infer<S>; // parsed by `schema` inside the API client
  } catch (error) {
    if (error instanceof ApiError) return undefined;
    throw error;
  }
}

export interface HomeData {
  summary: HomeSummary | undefined;
  heroBanners: Banner[];
  mobileBanners: Banner[];
  stripBanners: Banner[];
  popular: { items: PopularComplex[]; updatedAt: string | null } | undefined;
  listings: ListingPage | undefined;
  videos: VideoItem[];
  agencies: AgencyItem[];
  app: { iosUrl: string | null; androidUrl: string | null } | null;
}

const banners = (slot: BannerSlot) =>
  safe('/banners', bannerListSchema, { query: { slot }, revalidate: 60, tags: ['banners'] }).then(
    (r) => r?.items ?? [],
  );

export async function getHomeData(): Promise<HomeData> {
  const [
    summary,
    heroBanners,
    mobileBanners,
    stripBanners,
    popular,
    listings,
    videos,
    agencies,
    settings,
  ] = await Promise.all([
    safe('/home/summary', homeSummarySchema, { revalidate: 300, tags: ['home'] }),
    banners(BannerSlot.MAIN_HERO),
    banners(BannerSlot.MOBILE_MAIN),
    banners(BannerSlot.MAIN_STRIP),
    safe('/complexes/popular', popularComplexListSchema, {
      query: { limit: HOME_LIMITS.ranking, assetTypes: categoryOf('apt').assetTypes },
      revalidate: 300,
      tags: ['complexes'],
    }),
    safe('/listings', listingPageSchema, {
      query: { sort: ListingSort.VERIFIED, verifiedOnly: true, pageSize: HOME_LIMITS.listings },
      revalidate: 60,
      tags: ['listings'],
    }),
    safe('/videos', videoPageSchema, {
      query: { pageSize: HOME_LIMITS.videos },
      revalidate: 300,
      tags: ['videos'],
    }),
    safe('/agencies', agencyPageSchema, {
      query: { pageSize: HOME_LIMITS.agencies },
      revalidate: 300,
      tags: ['agencies'],
    }),
    safe('/site-settings/public', appSettingsSchema, { revalidate: 300, tags: ['site-settings'] }),
  ]);

  const links = settings?.APP_LINKS;
  const appEnabled = settings?.FEATURES?.appBand === true && !!(links?.iosUrl || links?.androidUrl);

  return {
    summary,
    heroBanners,
    mobileBanners,
    stripBanners,
    popular,
    listings,
    videos: videos?.items ?? [],
    agencies: agencies?.items ?? [],
    app: appEnabled
      ? { iosUrl: links?.iosUrl ?? null, androidUrl: links?.androidUrl ?? null }
      : null,
  };
}
