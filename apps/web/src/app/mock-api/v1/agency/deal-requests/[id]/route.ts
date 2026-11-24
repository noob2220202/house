import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import {
  agencyGuard,
  agencyRequestDetailDto,
  findInboxRequest,
  forcedFailure,
  requestNotFound,
} from '../_store';

/**
 * GET /api/v1/agency/deal-requests/:id — one request as the agency sees it, with the agency's own
 * proposal. `contact` (name, phone, 도로명·동·호) is only present while the requester's
 * DealRequestContactGrant for this agency is active; requests that do not reach the agency are 404.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = agencyGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 250);
  const forced = forcedFailure(req);
  if (forced) return forced;
  const { id } = await ctx.params;
  const found = findInboxRequest(id);
  return found ? mockJson(agencyRequestDetailDto(found)) : requestNotFound();
}
