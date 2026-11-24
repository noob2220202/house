import type { NextRequest } from 'next/server';
import { mockCsv, mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { agencyGuard, forcedFailure, inboxRequests, MY_AGENCY_ID } from '../deal-requests/_store';

/**
 * GET /api/v1/agency/proposals?status&page&pageSize — the mock office's proposals, newest first,
 * in the API's `AgencyProposalView` shape (`status` = CSV of ProposalStatus). The console reads
 * only `total` (응답 대기 tile: `status=SENT,VIEWED&pageSize=1`).
 * Dev: `?_fail=1` → 500.
 */
export async function GET(req: NextRequest) {
  const g = agencyGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 200);
  const forced = forcedFailure(req);
  if (forced) return forced;
  const statuses = mockCsv(req.nextUrl.searchParams, 'status');
  const rows = inboxRequests()
    .flatMap((request) =>
      request.proposals
        .filter((p) => p.agencyId === MY_AGENCY_ID)
        .filter((p) => statuses.length === 0 || statuses.includes(p.status))
        .map((p) => ({
          id: p.id,
          dealRequestId: request.id,
          status: p.status,
          message: p.message,
          suggestedPrice: null,
          suggestedDeposit: null,
          suggestedMonthlyRent: null,
          listingIds: p.listings.map((l) => String(l.id)),
          memberId: null,
          viewedAt: p.viewedAt,
          respondedAt: p.respondedAt,
          createdAt: p.createdAt,
          dealRequest: {
            type: request.type,
            status: request.status,
            assetType: request.assetType,
            dealTypes: request.dealTypes,
          },
        })),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return mockJson(mockPaginate(rows, req, { pageSize: 20 }));
}
