import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { ownerGuard, proposalNotFound, requestClosed } from '../../../../deal-requests/_guard';
import { proposalDtoById } from '../../../../deal-requests/_store';

// POST /api/v1/me/proposals/:id/decline — the requester answers a proposal → DECLINED.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = ownerGuard(req, { mutation: true });
  if (blocked) return blocked;
  await mockDelay(req, 300);
  const { id } = await ctx.params;
  const found = proposalDtoById(id);
  if (!found) return proposalNotFound();
  if (found.request.status !== 'OPEN' && found.request.status !== 'MATCHED') return requestClosed();
  if (found.proposal.status === 'WITHDRAWN')
    return mockError(409, 'PROPOSAL_NOT_FOUND', '중개사무소가 철회한 제안입니다.');
  const now = new Date().toISOString();
  found.proposal.status = 'DECLINED';
  found.proposal.respondedAt = now;
  found.proposal.viewedAt ??= now;

  found.request.updatedAt = now;
  return mockJson(found.dto());
}
