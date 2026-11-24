import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { agencyRequestDto, inboxRequests, stageOf } from '../../../agency/deal-requests/_store';
import { inquiryStore, unreadInquiryCount } from '../../../agency/inquiries/_store';
import { emptyDashboard, seedDashboard } from '../_fixtures';
import { agencyContext, agencyNotFound } from '../_store';

/**
 * GET /api/v1/agencies/mine/dashboard (ASSUMED) — aggregate for the console home and the sidebar
 * badges: listing counts, 7-day views, new 내놓기·구하기 requests, inquiries, expiring listings and
 * listings whose 실매물 확인 is due. AGENT / AGENCY_OWNER of an approved agency.
 * Dev: `?_empty=1` (or the dev-state switch) returns the empty states.
 */
export async function GET(req: NextRequest) {
  const ctx = agencyContext(req);
  if (!('state' in ctx)) return ctx;
  await mockDelay(req, 250);
  if (!ctx.agency || ctx.role === 'USER') return agencyNotFound();
  if (ctx.agency.status !== 'APPROVED') {
    return mockError(403, 'AGENCY_NOT_APPROVED', '승인된 중개사무소만 이용할 수 있습니다.');
  }
  if (req.nextUrl.searchParams.get('_fail') === '1') {
    return mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.');
  }
  const empty = ctx.state.emptyDashboard || req.nextUrl.searchParams.get('_empty') === '1';
  if (empty) return mockJson(emptyDashboard());
  // The feeds are the first rows of the inbox mocks, in their own shapes (agencyDealRequestSchema,
  // inquirySchema) — the console home and the inbox then name a request the same way.
  const requests = [...inboxRequests()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const fresh = requests.filter((r) => stageOf(r) === 'NEW');
  const inquiries = [...inquiryStore().items].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  return mockJson({
    ...seedDashboard(),
    dealRequests: {
      newCount: fresh.length,
      newSellCount: fresh.filter((r) => r.type === 'SELL_OR_LEASE').length,
      newWantedCount: fresh.filter((r) => r.type === 'WANTED').length,
      items: requests.slice(0, 4).map((r) => agencyRequestDto(r)),
    },
    inquiries: { unreadCount: unreadInquiryCount(), items: inquiries.slice(0, 3) },
  });
}
