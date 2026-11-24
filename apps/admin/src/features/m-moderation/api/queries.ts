import type {
  AgencyStatus,
  DealRequestStatus,
  ListingStatus,
  ReportAction,
  ReportStatus,
} from '@house/shared';
import { z } from 'zod';
import { api, apiUrl, qk, type QueryParams } from '@/lib/api';
import {
  adminAgencyDetailSchema,
  adminAgencyPageSchema,
  adminDealRequestDetailSchema,
  adminDealRequestPageSchema,
  adminListingDetailSchema,
  adminListingPageSchema,
  adminReportDetailSchema,
  adminReportPageSchema,
  adminUserDetailSchema,
  adminUserPageSchema,
  registryCheckSchema,
} from './schemas';

/** Rows per page of every moderation list. */
export const MOD_PAGE_SIZE = 10;

/**
 * One path segment from a route param. Ids come from the URL, so they are encoded (and `.`/`..`
 * rejected) — a crafted link must not be able to point a GET or a decision POST at another path.
 */
export function seg(id: string): string {
  if (id === '' || id === '.' || id === '..') return '_';
  return encodeURIComponent(id);
}

/** Query keys: [resource, scope, params] — invalidate a whole resource after a mutation. */
export const modKeys = {
  agencies: (params: QueryParams) => qk('admin-agencies', 'list', params),
  agencyCounts: qk('admin-agencies', 'counts'),
  agency: (id: string) => qk('admin-agencies', 'detail', id),
  listings: (params: QueryParams) => qk('admin-listings', 'list', params),
  listingCounts: qk('admin-listings', 'counts'),
  listing: (id: string) => qk('admin-listings', 'detail', id),
  reports: (params: QueryParams) => qk('admin-reports', 'list', params),
  reportCounts: qk('admin-reports', 'counts'),
  report: (id: string) => qk('admin-reports', 'detail', id),
  dealRequests: (params: QueryParams) => qk('admin-deal-requests', 'list', params),
  dealRequestCounts: qk('admin-deal-requests', 'counts'),
  dealRequest: (id: string) => qk('admin-deal-requests', 'detail', id),
  users: (params: QueryParams) => qk('admin-users', 'list', params),
  userCounts: qk('admin-users', 'counts'),
  user: (id: string) => qk('admin-users', 'detail', id),
} as const;

/** Envelope with only `total` — used for tab counts (`pageSize=1`), no extra endpoint needed. */
const totalOnlySchema = z.object({ total: z.number() });

/**
 * Tab counts without a dedicated endpoint: one `pageSize=1` list call per tab, reading `total`.
 * A failed count resolves to `undefined` (the tab simply shows no number).
 */
export async function fetchCounts<K extends string>(
  path: string,
  tabs: Record<K, QueryParams>,
  signal?: AbortSignal,
): Promise<Partial<Record<K, number>>> {
  const keys = Object.keys(tabs) as K[];
  const totals = await Promise.all(
    keys.map((key) =>
      api
        .get(path, {
          query: { ...tabs[key], page: 1, pageSize: 1 },
          schema: totalOnlySchema,
          signal,
        })
        .then((r) => r.total)
        .catch(() => undefined),
    ),
  );
  const out: Partial<Record<K, number>> = {};
  keys.forEach((key, i) => {
    const total = totals[i];
    if (total !== undefined) out[key] = total;
  });
  return out;
}

// ---------- agencies -------------------------------------------------------------------------

export function fetchAgencies(query: QueryParams, signal?: AbortSignal) {
  return api.get('/admin/agencies', { query, schema: adminAgencyPageSchema, signal });
}
export function fetchAgency(id: string, signal?: AbortSignal) {
  return api.get(`/admin/agencies/${seg(id)}`, { schema: adminAgencyDetailSchema, signal });
}
/** POST /admin/agencies/:id/decision — body = `agencyDecisionSchema` (@house/shared). */
export function decideAgency(
  id: string,
  body: { status: Exclude<AgencyStatus, 'PENDING'>; reason?: string },
) {
  return api.post(`/admin/agencies/${seg(id)}/decision`, body, { schema: adminAgencyDetailSchema });
}
/** POST /admin/agencies/:id/registry-check — re-run the registry lookup (ASSUMED endpoint). */
export function recheckAgencyRegistry(id: string) {
  return api.post(`/admin/agencies/${seg(id)}/registry-check`, undefined, {
    schema: registryCheckSchema,
  });
}
/** URL of the authorized private-file stream `GET /admin/agencies/:id/documents/:docId`. */
export function agencyDocumentUrl(agencyId: string, docId: string): string {
  return apiUrl(`/admin/agencies/${seg(agencyId)}/documents/${seg(docId)}`);
}

// ---------- listings -------------------------------------------------------------------------

export function fetchListings(query: QueryParams, signal?: AbortSignal) {
  return api.get('/admin/listings', { query, schema: adminListingPageSchema, signal });
}
export function fetchListing(id: string, signal?: AbortSignal) {
  return api.get(`/admin/listings/${seg(id)}`, { schema: adminListingDetailSchema, signal });
}
export type ListingModerationAction = 'hide' | 'unhide' | 'close';
/** POST /admin/listings/:id/{hide|unhide|close} — body `{ reason }` (ASSUMED endpoints). */
export function moderateListing(id: string, action: ListingModerationAction, reason?: string) {
  return api.post(
    `/admin/listings/${seg(id)}/${action}`,
    { reason },
    { schema: adminListingDetailSchema },
  );
}
export type { ListingStatus };

// ---------- reports --------------------------------------------------------------------------

export function fetchReports(query: QueryParams, signal?: AbortSignal) {
  return api.get('/admin/reports', { query, schema: adminReportPageSchema, signal });
}
export function fetchReport(id: string, signal?: AbortSignal) {
  return api.get(`/admin/reports/${seg(id)}`, { schema: adminReportDetailSchema, signal });
}
/** POST /admin/reports/:id/resolve — body = `reportResolveSchema` (@house/shared). */
export function resolveReport(
  id: string,
  body: { status: Exclude<ReportStatus, 'RECEIVED'>; action?: ReportAction; note?: string },
) {
  return api.post(`/admin/reports/${seg(id)}/resolve`, body, { schema: adminReportDetailSchema });
}
/**
 * PATCH /admin/reports/:id `{ internalNote }` — save the moderators' internal memo without changing
 * the status. Separate from the resolution `note` (which is forwarded to the reporter / office).
 */
export function saveReportNote(id: string, internalNote: string) {
  return api.patch(
    `/admin/reports/${seg(id)}`,
    { internalNote },
    { schema: adminReportDetailSchema },
  );
}

// ---------- deal requests --------------------------------------------------------------------

export function fetchDealRequests(query: QueryParams, signal?: AbortSignal) {
  return api.get('/admin/deal-requests', { query, schema: adminDealRequestPageSchema, signal });
}
export function fetchDealRequest(id: string, signal?: AbortSignal) {
  return api.get(`/admin/deal-requests/${seg(id)}`, {
    schema: adminDealRequestDetailSchema,
    signal,
  });
}
/** POST /admin/deal-requests/:id/spam-flag — `{ flagged, reason? }` (ASSUMED endpoint). */
export function flagDealRequestSpam(id: string, flagged: boolean, reason?: string) {
  return api.post(
    `/admin/deal-requests/${seg(id)}/spam-flag`,
    { flagged, reason },
    { schema: adminDealRequestDetailSchema },
  );
}
/** POST /admin/deal-requests/:id/close — `{ reason }` (ASSUMED endpoint). */
export function closeDealRequest(id: string, reason: string) {
  return api.post(
    `/admin/deal-requests/${seg(id)}/close`,
    { reason },
    { schema: adminDealRequestDetailSchema },
  );
}
export type { DealRequestStatus };

// ---------- users ----------------------------------------------------------------------------

export function fetchUsers(query: QueryParams, signal?: AbortSignal) {
  return api.get('/admin/users', { query, schema: adminUserPageSchema, signal });
}
/** GET /admin/users/:id — personal data; the backend writes an audit-log entry for every read. */
export function fetchUser(id: string, signal?: AbortSignal) {
  return api.get(`/admin/users/${seg(id)}`, { schema: adminUserDetailSchema, signal });
}
export function suspendUser(id: string, reason: string) {
  return api.post(`/admin/users/${seg(id)}/suspend`, { reason }, { schema: adminUserDetailSchema });
}
export function unsuspendUser(id: string) {
  return api.post(`/admin/users/${seg(id)}/unsuspend`, undefined, {
    schema: adminUserDetailSchema,
  });
}
