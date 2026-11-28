import type { AgencyInquiryUpdateInput, InquiryStatus } from '@house/shared';
import { api, apiFetch, qk } from '@/lib/api';
import {
  inquiryFiltersToQuery,
  requestFiltersToQuery,
  type InquiryFilters,
  type RequestFilters,
} from '../lib/params';
import {
  agencyDealRequestDetailSchema,
  agencyDealRequestPageSchema,
  agencyInquiryPageSchema,
  agencyInquirySchema,
  inboxNewCountSchema,
  inquiryReadResultSchema,
  listingCandidatePageSchema,
  myProposalSchema,
  proposalTotalSchema,
  WAITING_PROPOSALS_QUERY,
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
  inquiry: (id: string) => qk('agency-inquiries', 'detail', id),
  /** a-agency's dashboard aggregate — feeds the sidebar badges (새 요청 / 안 읽은 문의 / 실매물 확인). */
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

/** Counters of the /agent/notifications tiles; null = that call failed (the tile shows "–"). */
export interface InboxCounts {
  newRequests: number | null;
  waitingProposals: number | null;
  unreadInquiries: number | null;
}

/**
 * 새 요청 from the console dashboard aggregate (GET /agencies/mine/dashboard) and 응답 대기 from
 * GET /agency/proposals?status=SENT,VIEWED (its total). Each counter fails on its own.
 */
export async function fetchInboxCounts(signal?: AbortSignal): Promise<InboxCounts> {
  const [dashboard, waiting] = await Promise.allSettled([
    api.get('/agencies/mine/dashboard', { schema: inboxNewCountSchema, signal }),
    api.get('/agency/proposals', {
      query: WAITING_PROPOSALS_QUERY,
      schema: proposalTotalSchema,
      signal,
    }),
  ]);
  return {
    newRequests: dashboard.status === 'fulfilled' ? dashboard.value.dealRequests.newCount : null,
    waitingProposals: waiting.status === 'fulfilled' ? waiting.value.total : null,
    unreadInquiries:
      dashboard.status === 'fulfilled' ? (dashboard.value.inquiries?.unreadCount ?? null) : null,
  };
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

// ---------- 문의함 (inquiries) ----------

/** GET /agency/inquiries — written inquiries and contact events of the caller's office. */
export function fetchInquiries(filters: InquiryFilters, signal?: AbortSignal) {
  return api.get('/agency/inquiries', {
    query: inquiryFiltersToQuery(filters),
    schema: agencyInquiryPageSchema,
    signal,
  });
}

/** GET /agency/inquiries/:id — with the thread (`messages`); other offices' rows answer 404. */
export function fetchInquiry(id: string, signal?: AbortSignal) {
  return api.get(`/agency/inquiries/${encodeURIComponent(id)}`, {
    schema: agencyInquirySchema,
    signal,
  });
}

export type InquiryPatch = AgencyInquiryUpdateInput & { status?: InquiryStatus };

/**
 * PATCH /agency/inquiries/:id — 처리 상태, internal memo, read flag. The drawer re-reads the
 * inquiry afterwards, so only the status code matters.
 */
export function updateInquiry(id: string, patch: InquiryPatch) {
  return api.patch(`/agency/inquiries/${encodeURIComponent(id)}`, patch);
}

/** POST /agency/inquiries/:id/replies — only offered when `canReply` (else 409). */
export function replyToInquiry(id: string, message: string) {
  return api.post(`/agency/inquiries/${encodeURIComponent(id)}/replies`, { message });
}

/** POST /agency/inquiries/read `{ all: true }` → `{ updated, unreadCount }`. */
export function markAllInquiriesRead() {
  return api.post('/agency/inquiries/read', { all: true }, { schema: inquiryReadResultSchema });
}

/** DELETE /agency/inquiries/:id — removes it from the 문의함 (스팸 처리 / 정리); reason optional. */
export function deleteInquiry(id: string, reason?: string) {
  return apiFetch(`/agency/inquiries/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    body: reason ? { reason } : undefined,
  });
}
