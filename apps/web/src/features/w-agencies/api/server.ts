import 'server-only';
import type { QueryParams } from '@/lib/api';
import { serverGetDetail, serverGetOr } from '@/lib/api/server';
import {
  agencyListingsQuery,
  type AgencyListingsParams,
  type AgencyListingsScope,
} from './queries';
import {
  agencyDetailSchema,
  agencyListingPageSchema,
  agencyPageSchema,
  agencyRegionsSchema,
  type AgencyDetail,
  type AgencyListingPage,
  type AgencyPage,
  type AgencyRegions,
} from './schemas';

/**
 * Agency profile for the SEO page. Null on 404 / 400 (malformed id) → `notFound()`; other errors
 * throw. The outcome is cached, so an office that stops being public later 404s (D-E).
 */
export function getAgency(id: string): Promise<AgencyDetail | null> {
  return serverGetDetail(`/agencies/${encodeURIComponent(id)}`, {
    schema: agencyDetailSchema,
    revalidate: 120,
    tags: ['agencies', `agency:${id}`],
  });
}

/** First page of the office's listings for the initial render; null when the API fails (the client retries). */
export function getAgencyListings(
  id: string,
  params: AgencyListingsParams,
  scope?: AgencyListingsScope,
): Promise<AgencyListingPage | null> {
  return serverGetOr<AgencyListingPage | null, typeof agencyListingPageSchema>('/listings', null, {
    query: agencyListingsQuery(id, params, scope),
    schema: agencyListingPageSchema,
    revalidate: 60,
    tags: ['listings', `agency:${id}`],
  });
}

/** Server-rendered first page of the office search (SEO + instant list); null when the API fails. */
export function getAgencies(query: QueryParams): Promise<AgencyPage | null> {
  return serverGetOr<AgencyPage | null, typeof agencyPageSchema>('/agencies', null, {
    query,
    schema: agencyPageSchema,
    revalidate: 60,
    tags: ['agencies'],
  });
}

export function getAgencyRegions(): Promise<AgencyRegions | null> {
  return serverGetOr<AgencyRegions | null, typeof agencyRegionsSchema>('/agencies/regions', null, {
    schema: agencyRegionsSchema,
    revalidate: 300,
    tags: ['agencies'],
  });
}
