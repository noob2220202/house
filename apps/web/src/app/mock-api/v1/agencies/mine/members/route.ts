import type { NextRequest } from 'next/server';
import { mockDelay, mockForbidden, mockJson, mockPaginate } from '@/lib/mock';
import { agencyContext, agencyNotFound } from '../_store';

/**
 * GET /api/v1/agencies/mine/members?page&pageSize&includeRemoved — AGENCY_OWNER only.
 * `Paginated<AgencyMemberView>`; invitations are not members (see /agencies/mine/invites).
 */
export async function GET(req: NextRequest) {
  const ctx = agencyContext(req);
  if (!('state' in ctx)) return ctx;
  await mockDelay(req);
  if (!ctx.agency || ctx.role === 'USER') return agencyNotFound();
  if (!ctx.isOwner) return mockForbidden();
  const includeRemoved = req.nextUrl.searchParams.get('includeRemoved') === 'true';
  const rows = ctx.state.members.filter((m) => includeRemoved || m.status !== 'REMOVED');
  return mockJson(mockPaginate(rows, req));
}
