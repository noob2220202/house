import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockForbidden } from '@/lib/mock';
import { agencyContext, agencyNotFound } from '../../_store';

/** DELETE /api/v1/agencies/mine/invites/:inviteId — AGENCY_OWNER only; the code stops working. */
export async function DELETE(req: NextRequest, ctx2: { params: Promise<{ inviteId: string }> }) {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 300);
  if (!ctx.agency || ctx.role === 'USER') return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  const { inviteId } = await ctx2.params;
  if (!ctx.state.invites.some((i) => i.id === inviteId)) {
    return mockError(404, 'AGENCY_INVITE_NOT_FOUND', '초대를 찾을 수 없습니다.');
  }
  ctx.state.invites = ctx.state.invites.filter((i) => i.id !== inviteId);
  return new Response(null, { status: 204 });
}
