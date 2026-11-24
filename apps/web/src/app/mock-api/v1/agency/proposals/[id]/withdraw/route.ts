import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import {
  agencyGuard,
  findMyProposal,
  myProposalDto,
  requestClosed,
} from '../../../deal-requests/_store';

/**
 * POST /api/v1/agency/proposals/:id/withdraw — the agency takes its proposal back while the
 * requester has not answered it (SENT / VIEWED) → WITHDRAWN. Returns the updated proposal.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = agencyGuard(req, { mutation: true });
  if (g.fail) return g.fail;
  await mockDelay(req, 350);
  const { id } = await ctx.params;
  const found = findMyProposal(id);
  if (!found) return mockError(404, 'PROPOSAL_NOT_FOUND', '제안을 찾을 수 없습니다.');
  const { request, proposal } = found;
  if (request.status !== 'OPEN' && request.status !== 'MATCHED') return requestClosed();
  if (proposal.status !== 'SENT' && proposal.status !== 'VIEWED')
    return mockError(409, 'CONFLICT', '요청자가 이미 답한 제안은 철회할 수 없습니다.');
  const now = new Date().toISOString();
  proposal.status = 'WITHDRAWN';
  proposal.respondedAt = now;
  request.updatedAt = now;
  return mockJson(myProposalDto(proposal, true));
}
