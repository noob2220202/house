import type { NextRequest } from 'next/server';
import { rankListings } from '@/features/a-inbox/lib/match';
import { mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { OFFICE_LISTINGS } from '../../_listings';
import {
  agencyGuard,
  agencyRequestDto,
  findInboxRequest,
  forcedFailure,
  requestNotFound,
} from '../../_store';

/**
 * GET /api/v1/agency/deal-requests/:id/listing-candidates?q&page&pageSize (ASSUMED)
 * The agency's ACTIVE listings that may be attached to a proposal, best match for the request
 * first. `q` searches the title. Could be replaced by `GET /agency/listings?status=ACTIVE&q=`
 * (the client ranks again with the same rule).
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = agencyGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 250);
  const forced = forcedFailure(req);
  if (forced) return forced;
  const { id } = await ctx.params;
  const found = findInboxRequest(id);
  if (!found) return requestNotFound();
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  const rows = OFFICE_LISTINGS.filter((l) => !q || l.title.toLowerCase().includes(q));
  const ranked = rankListings(agencyRequestDto(found), rows).map((r) => r.listing);
  return mockJson(mockPaginate(ranked, req, { pageSize: 50 }));
}
