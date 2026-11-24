import 'server-only';
import type { QueryParams } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { serverGet, serverGetOr } from '@/lib/api/server';
import { agencyListingsQuery, type AgencyListingsParams } from './queries';
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

/** Agency profile for the SEO page. Returns null on 404 (→ `notFound()`); other errors throw. */
export async function getAgency(id: string): Promise<AgencyDetail | null> {
  try {
    return await serverGet(`/agencies/${encodeURIComponent(id)}`, {
      schema: agencyDetailSchema,
      revalidate: 120,
      tags: ['agencies', `agency:${id}`],
    });
  } catch (error) {
    // A malformed id is a 400 from the real API — treat it like a missing office.
    if (error instanceof ApiError && (error.isNotFound || error.status === 400)) return null;
    throw error;
  }
}

/** First page of the office's listings for the initial render; null when the API fails (the client retries). */
export function getAgencyListings(
  id: string,
  params: AgencyListingsParams,
): Promise<AgencyListingPage | null> {
  return serverGetOr<AgencyListingPage | null, typeof agencyListingPageSchema>('/listings', null, {
    query: agencyListingsQuery(id, params),
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
