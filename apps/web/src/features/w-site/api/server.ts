import 'server-only';
import { siteSlugProblem, type AssetType } from '@house/shared';
import { unstable_cache } from 'next/cache';
import { cache } from 'react';
import type { AgencyListingPage } from '@/features/w-agencies/api/schemas';
import { getAgencyListings } from '@/features/w-agencies/api/server';
import { ApiError, apiFetch } from '@/lib/api';
import { SSR_MARKER } from '@/lib/api/forward';
import { officeSiteSchema, type OfficeSite } from './schemas';

/** Cache tags of one office site (bump on approval, colour / 한 줄 소개 and profile changes). */
export const officeSiteTags = (slug: string) => ['sites', `site:${slug}`];

/**
 * The servable office site of `slug`, or null (unknown, not approved, suspended, subscription
 * gate) → the office-site 404. A slug that breaks the slug rules never reaches the API.
 */
export async function getOfficeSite(slug: string): Promise<OfficeSite | null> {
  if (siteSlugProblem(slug) !== null) return null;
  // The outcome (site or null) is cached for 60 s, not the response: Next's fetch cache stores
  // only 200s, so once a site had been cached a later 404 (suspended, agency hidden, subscription
  // gate) never replaced the stale entry and the closed site stayed up until a restart.
  return unstable_cache(() => fetchOfficeSite(slug), ['office-site', slug], {
    revalidate: 60,
    tags: officeSiteTags(slug),
  })();
}

async function fetchOfficeSite(slug: string): Promise<OfficeSite | null> {
  try {
    return await apiFetch(`/sites/${encodeURIComponent(slug)}`, {
      method: 'GET',
      cache: 'no-store',
      schema: officeSiteSchema,
      headers: { ...SSR_MARKER },
    });
  } catch (error) {
    if (error instanceof ApiError && (error.isNotFound || error.status === 400)) return null;
    throw error;
  }
}

/** One fetch per request for the layout, generateMetadata / generateViewport and the pages. */
export const loadOfficeSite = cache(getOfficeSite);

/** Listings of the office's own site: only those it registered first (`primaryAgencyId`). */
export const PRIMARY_ONLY = { primaryOnly: true } as const;

export interface OfficeListingFacts {
  /** First page of the primary listings without filters (the default view's server render). */
  all: AgencyListingPage | null;
  /** Listings the office registered first; null when the API failed. */
  total: number | null;
  /** Primary listings per 종류: the tabs and the `?page` bound. */
  byAsset: Partial<Record<AssetType, number>>;
  /** Every number is primary-only. False: some fell back to the office-wide counters. */
  exact: boolean;
}

/**
 * What the office site counts (D-D): its primary listings only. The office counters of the profile
 * include co-brokered listings the site never shows (a tab that is always empty, a "매물 N건" the
 * grid contradicts). Per-종류 totals are read only when the office co-brokers anything (else the
 * counters are already primary-only) and when it lists more than one 종류; each is the cached
 * first page of that tab. One load per request (metadata + page).
 */
export const loadOfficeListingFacts = cache(
  async (site: OfficeSite): Promise<OfficeListingFacts> => {
    const a = site.agency;
    const all = await getAgencyListings(a.id, {}, PRIMARY_ONLY);
    if (!all) return { all, total: null, byAsset: a.listingCountsByAsset, exact: false };
    const kinds = (Object.keys(a.listingCountsByAsset) as AssetType[]).filter(
      (k) => (a.listingCountsByAsset[k] ?? 0) > 0,
    );
    if (all.total === a.activeListingCount) {
      return { all, total: all.total, byAsset: a.listingCountsByAsset, exact: true };
    }
    if (all.total === 0) return { all, total: 0, byAsset: {}, exact: true };
    if (kinds.length === 1) {
      return { all, total: all.total, byAsset: { [kinds[0]!]: all.total }, exact: true };
    }
    const pages = await Promise.all(
      kinds.map((assetType) => getAgencyListings(a.id, { assetType }, PRIMARY_ONLY)),
    );
    const byAsset: Partial<Record<AssetType, number>> = {};
    let exact = true;
    kinds.forEach((kind, i) => {
      const page = pages[i];
      if (!page) exact = false;
      const n = page ? page.total : (a.listingCountsByAsset[kind] ?? 0);
      if (n > 0) byAsset[kind] = n;
    });
    return { all, total: all.total, byAsset, exact };
  },
);
