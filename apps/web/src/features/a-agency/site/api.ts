import type { AgencySiteRequestInput, AgencySiteUpdateInput } from '@house/shared';
import { api, qk } from '@/lib/api';
import { myAgencySiteSchema, siteSlugAvailabilitySchema } from './schemas';

/** Query keys of 내 홈페이지 (resource `agencies`, like the rest of the console's office data). */
export const siteKeys = {
  mine: qk('agencies', 'mine-site'),
  availabilityAll: qk('agencies', 'mine-site-availability'),
  availability: (slug: string) => qk('agencies', 'mine-site-availability', slug),
} as const;

/** GET /agencies/mine/site — the office's site (null before the first request), root domain, 이용권. */
export function fetchMySite(signal?: AbortSignal) {
  return api.get('/agencies/mine/site', { schema: myAgencySiteSchema, signal });
}

/** GET /agencies/mine/site/availability?slug= — live check of the request form (owner). */
export function checkSiteSlug(slug: string, signal?: AbortSignal) {
  return api.get('/agencies/mine/site/availability', {
    query: { slug },
    schema: siteSlugAvailabilitySchema,
    signal,
  });
}

/** POST /agencies/mine/site — request, re-request after a rejection, or change a pending request. */
export function requestSite(body: AgencySiteRequestInput) {
  return api.post('/agencies/mine/site', body, { schema: myAgencySiteSchema });
}

/** PATCH /agencies/mine/site — brand colour and 한 줄 소개 (the slug only changes by request). */
export function updateSite(body: AgencySiteUpdateInput) {
  return api.patch('/agencies/mine/site', body, { schema: myAgencySiteSchema });
}
