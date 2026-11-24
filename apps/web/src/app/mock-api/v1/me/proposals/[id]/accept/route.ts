import { proposalAcceptSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { ownerGuard, proposalNotFound, requestClosed } from '../../../../deal-requests/_guard';
import { proposalDtoById } from '../../../../deal-requests/_store';

// POST /api/v1/me/proposals/:id/accept { shareContact } — the requester answers a proposal →
// ACCEPTED; `shareContact: true` also reveals the contact to that agency (contact grant).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const blocked = ownerGuard(req, { mutation: true });
  if (blocked) return blocked;
  await mockDelay(req, 300);
  const { id } = await ctx.params;
  const found = proposalDtoById(id);
  if (!found) return proposalNotFound();
  if (found.request.status !== 'OPEN' && found.request.status !== 'MATCHED') return requestClosed();
  const body = proposalAcceptSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'shareContact', message: '연락처 공개 여부를 선택해 주세요.' },
    ]);
  }
  if (found.proposal.status === 'WITHDRAWN')
    return mockError(409, 'PROPOSAL_NOT_FOUND', '중개사무소가 철회한 제안입니다.');
  const now = new Date().toISOString();
  found.proposal.status = 'ACCEPTED';
  found.proposal.respondedAt = now;
  found.proposal.viewedAt ??= now;
  if (found.request.status === 'OPEN') found.request.status = 'MATCHED';
  if (body.data.shareContact) found.request.grants[found.proposal.agencyId] ??= now;
  found.request.updatedAt = now;
  return mockJson(found.dto());
}
