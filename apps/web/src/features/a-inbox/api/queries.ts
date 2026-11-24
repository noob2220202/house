import { api, qk } from '@/lib/api';
import {
  inquiryFiltersToQuery,
  requestFiltersToQuery,
  type InquiryFilters,
  type RequestFilters,
} from '../lib/params';
import {
  agencyDealRequestDetailSchema,
  agencyDealRequestPageSchema,
  inquiryPageSchema,
  inquiryReadResultSchema,
  inquirySchema,
  listingCandidatePageSchema,
  myProposalSchema,
  type InquiryStatus,
} from './schemas';

/** Query keys of the broker inbox: `[resource, scope, params]` (invalidate by resource). */
export const inboxKeys = {
  requests: qk('agency-deal-requests'),
  requestList: (filters: Omit<RequestFilters, never>) =>
    qk('agency-deal-requests', 'list', filters),
  requestSummary: qk('agency-deal-requests', 'summary'),
  request: (id: string) => qk('agency-deal-requests', 'detail', id),
  candidates: (id: string, q: string) => qk('agency-deal-requests', 'candidates', { id, q }),
  inquiries: qk('agency-inquiries'),
  inquiryList: (filters: Omit<InquiryFilters, 'id'>) => qk('agency-inquiries', 'list', filters),
  inquirySummary: qk('agency-inquiries', 'summary'),
  /** a-agency's dashboard aggregate — feeds the sidebar badges (새 요청 / 안 읽은 문의). */
  dashboard: qk('agencies', 'mine-dashboard'),
} as const;

// ---------- 내놓기 · 구하기 requests ----------

/** GET /agency/deal-requests — requests visible to the caller's agency (no contact data). */
export function fetchAgencyRequests(filters: RequestFilters, signal?: AbortSignal) {
  return api.get('/agency/deal-requests', {
    query: requestFiltersToQuery(filters),
    schema: agencyDealRequestPageSchema,
    signal,
  });
}

/** Cheapest call that still returns the stage counters (used for summary tiles). */
export function fetchRequestSummary(signal?: AbortSignal) {
  return api.get('/agency/deal-requests', {
    query: { page: 1, pageSize: 1 },
    schema: agencyDealRequestPageSchema,
    signal,
  });
}

/** GET /agency/deal-requests/:id — `contact` is only present while the requester's grant is active. */
export function fetchAgencyRequest(id: string, signal?: AbortSignal) {
  return api.get(`/agency/deal-requests/${encodeURIComponent(id)}`, {
    schema: agencyDealRequestDetailSchema,
    signal,
  });
}

/** POST /agency/deal-requests/:id/proposals — body = proposalCreateSchema (@house/shared). */
export function sendProposal(id: string, body: { message: string; listingIds: string[] }) {
  return api.post(`/agency/deal-requests/${encodeURIComponent(id)}/proposals`, body, {
    schema: myProposalSchema,
  });
}

/** POST /agency/proposals/:id/withdraw */
export function withdrawProposal(proposalId: string) {
  return api.post(`/agency/proposals/${encodeURIComponent(proposalId)}/withdraw`, undefined, {
    schema: myProposalSchema,
  });
}

export const CANDIDATE_PAGE_SIZE = 50;

/**
 * GET /agency/deal-requests/:id/listing-candidates?q — the agency's ACTIVE listings that can be
 * attached to a proposal for this request (ASSUMED endpoint).
 */
export function fetchListingCandidates(id: string, q: string, signal?: AbortSignal) {
  return api.get(`/agency/deal-requests/${encodeURIComponent(id)}/listing-candidates`, {
    query: { q: q || undefined, page: 1, pageSize: CANDIDATE_PAGE_SIZE },
    schema: listingCandidatePageSchema,
    signal,
  });
}

// ---------- inquiries (ASSUMED resource) ----------

/** GET /agency/inquiries — contact log of the agency's listings and office page. */
export function fetchInquiries(filters: InquiryFilters, signal?: AbortSignal) {
  return api.get('/agency/inquiries', {
    query: inquiryFiltersToQuery(filters),
    schema: inquiryPageSchema,
    signal,
  });
}

export function fetchInquirySummary(signal?: AbortSignal) {
  return api.get('/agency/inquiries', {
    query: { page: 1, pageSize: 1 },
    schema: inquiryPageSchema,
    signal,
  });
}

export function fetchInquiry(id: string, signal?: AbortSignal) {
  return api.get(`/agency/inquiries/${encodeURIComponent(id)}`, { schema: inquirySchema, signal });
}

export interface InquiryPatch {
  status?: InquiryStatus;
  memo?: string | null;
  /** true = mark read. */
  read?: boolean;
}

/** PATCH /agency/inquiries/:id — handling status, private memo, read flag. */
export function updateInquiry(id: string, patch: InquiryPatch) {
  return api.patch(`/agency/inquiries/${encodeURIComponent(id)}`, patch, { schema: inquirySchema });
}

/** POST /agency/inquiries/:id/replies — only offered when `canReply` is true. */
export function replyToInquiry(id: string, message: string) {
  return api.post(
    `/agency/inquiries/${encodeURIComponent(id)}/replies`,
    { message },
    { schema: inquirySchema },
  );
}

/** POST /agency/inquiries/read — `{ all: true }` marks every inquiry read. */
export function markAllInquiriesRead() {
  return api.post('/agency/inquiries/read', { all: true }, { schema: inquiryReadResultSchema });
}
