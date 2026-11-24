import { api, qk } from '@/lib/api';
import { requestFiltersToQuery, type RequestFilters } from '../lib/params';
import {
  agencyDealRequestDetailSchema,
  agencyDealRequestPageSchema,
  inboxNewCountSchema,
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
  /** a-agency's dashboard aggregate — feeds the sidebar badges (새 요청 / 실매물 확인). */
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
