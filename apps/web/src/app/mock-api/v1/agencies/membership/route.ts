import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { agencyContext } from '../mine/_store';

/**
 * GET /api/v1/agencies/membership — the caller's live membership (`MyAgencyMembership`):
 * `{ memberId, role, displayName, agency: { id, name, phone, roadAddress, status } }`; 404 when the
 * caller works for no agency.
 */
export async function GET(req: NextRequest) {
  const ctx = agencyContext(req);
  if (!('state' in ctx)) return ctx;
  await mockDelay(req);
  if (ctx.role === 'USER' || !ctx.agency) {
    return mockError(404, 'AGENCY_MEMBERSHIP_NOT_FOUND', '소속된 중개사무소가 없습니다.');
  }
  const role = ctx.isOwner ? 'OWNER' : 'AGENT';
  const member =
    ctx.state.members.find((m) => m.status === 'ACTIVE' && m.role === role) ?? ctx.state.members[0];
  const a = ctx.state.office;
  return mockJson({
    memberId: member?.id ?? 'mem-1',
    role,
    displayName: member?.displayName ?? a.representativeName,
    agency: {
      id: a.id,
      name: a.name,
      phone: a.phone,
      roadAddress: a.roadAddress,
      status: a.status,
    },
  });
}
