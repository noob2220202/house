import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockForbidden } from '@/lib/mock';
import { agencyContext, agencyNotFound } from '../../_store';

/**
 * DELETE /api/v1/agencies/mine/members/:memberId — AGENCY_OWNER only. Removes a staff member
 * (status → REMOVED) or cancels a pending invitation. The owner cannot be removed.
 */
export async function DELETE(req: NextRequest, ctx2: { params: Promise<{ memberId: string }> }) {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 350);
  if (!ctx.agency || ctx.role === 'USER') return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  const { memberId } = await ctx2.params;
  const member = ctx.state.members.find((m) => m.id === memberId && m.status !== 'REMOVED');
  if (!member) return mockError(404, 'AGENCY_MEMBER_NOT_FOUND', '소속 중개사를 찾을 수 없습니다.');
  if (member.role === 'OWNER') {
    return mockError(409, 'AGENCY_OWNER_NOT_REMOVABLE', '대표 공인중개사는 내보낼 수 없습니다.');
  }
  ctx.state.members = ctx.state.members.map((m) =>
    m.id === memberId ? { ...m, status: 'REMOVED' as const, inviteCode: null } : m,
  );
  return new Response(null, { status: 204 });
}
