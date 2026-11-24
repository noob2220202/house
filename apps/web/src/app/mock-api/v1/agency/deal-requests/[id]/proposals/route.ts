import { proposalCreateSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import type { InboxListing } from '@/features/a-inbox/api/schemas';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { officeListing } from '../../_listings';
import {
  addProposal,
  agencyGuard,
  findInboxRequest,
  MY_AGENCY_ID,
  myProposalDto,
  requestClosed,
  requestNotFound,
} from '../../_store';

/**
 * POST /api/v1/agency/deal-requests/:id/proposals — body `proposalCreateSchema`
 * `{ message, listingIds }`. One proposal per agency per request (`409 PROPOSAL_DUPLICATE`),
 * only while the request is OPEN / MATCHED (`409 DEAL_REQUEST_CLOSED`); attached listings must be
 * the agency's own ACTIVE listings. → 201 with the created proposal.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = agencyGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 450);
  const { id } = await ctx.params;
  const found = findInboxRequest(id);
  if (!found) return requestNotFound();
  if (found.status !== 'OPEN' && found.status !== 'MATCHED') return requestClosed();
  if (found.proposals.some((p) => p.agencyId === MY_AGENCY_ID))
    return mockError(409, 'PROPOSAL_DUPLICATE', '이미 제안을 보냈습니다.');

  const parsed = proposalCreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return mockError(
      400,
      'VALIDATION_FAILED',
      '입력값을 확인해 주세요.',
      parsed.error.issues.map((i) => ({ path: String(i.path[0] ?? ''), message: i.message })),
    );
  const listings = parsed.data.listingIds.map((listingId) => officeListing(listingId));
  if (listings.some((l) => !l))
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'listingIds', message: '우리 사무소의 광고중 매물만 첨부할 수 있습니다.' },
    ]);

  const proposal = addProposal(found, g.role, {
    message: parsed.data.message,
    listings: listings as InboxListing[],
  });
  return mockJson(myProposalDto(proposal, true), { status: 201 });
}
