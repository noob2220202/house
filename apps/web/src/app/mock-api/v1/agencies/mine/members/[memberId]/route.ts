import { agencyMemberUpdateSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockForbidden, mockJson } from '@/lib/mock';
import { agencyContext, agencyNotFound, readJson, validationError } from '../../_store';

type Params = { params: Promise<{ memberId: string }> };

const memberNotFound = () =>
  mockError(404, 'AGENCY_MEMBER_NOT_FOUND', '소속 중개사를 찾을 수 없습니다.');

/**
 * PATCH /api/v1/agencies/mine/members/:memberId — AGENCY_OWNER only (`agencyMemberUpdateSchema`):
 * 소속공인중개사 needs `licenseNumber` in the same request (400 otherwise), 중개보조원 clears it.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 300);
  if (!ctx.agency || ctx.role === 'USER') return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  const { memberId } = await params;
  const member = ctx.state.members.find((m) => m.id === memberId && m.status === 'ACTIVE');
  if (!member) return memberNotFound();
  const parsed = agencyMemberUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error.issues);
  if (member.role === 'OWNER' && parsed.data.isLicensed === false) {
    return mockError(
      400,
      'AGENCY_OWNER_LICENSE_REQUIRED',
      '대표 공인중개사의 자격은 바꿀 수 없습니다.',
    );
  }
  const { isLicensed, licenseNumber, ...profile } = parsed.data;
  const next = {
    ...member,
    ...Object.fromEntries(Object.entries(profile).filter(([, v]) => v !== undefined)),
    ...(isLicensed === undefined ? {} : { isLicensed }),
    ...(licenseNumber === undefined ? {} : { licenseNumber }),
  };
  if (isLicensed === false) next.licenseNumber = null;
  ctx.state.members = ctx.state.members.map((m) => (m.id === memberId ? next : m));
  return mockJson(next);
}

/**
 * DELETE /api/v1/agencies/mine/members/:memberId — AGENCY_OWNER only. Removes a staff member
 * (status → REMOVED); the owner cannot be removed.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = agencyContext(req, { mutation: true });
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 350);
  if (!ctx.agency || ctx.role === 'USER') return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  const { memberId } = await params;
  const member = ctx.state.members.find((m) => m.id === memberId && m.status !== 'REMOVED');
  if (!member) return memberNotFound();
  if (member.role === 'OWNER') {
    return mockError(409, 'AGENCY_OWNER_NOT_REMOVABLE', '대표 공인중개사는 내보낼 수 없습니다.');
  }
  const now = new Date().toISOString();
  ctx.state.members = ctx.state.members.map((m) =>
    m.id === memberId ? { ...m, status: 'REMOVED' as const, removedAt: now } : m,
  );
  return new Response(null, { status: 204 });
}
