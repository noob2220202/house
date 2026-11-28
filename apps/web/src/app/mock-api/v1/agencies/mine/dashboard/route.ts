import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockJson } from '@/lib/mock';
import { agencyRequestDto, inboxRequests, stageOf } from '../../../agency/deal-requests/_store';
import {
  agencyInquiryView,
  ensureInquiryNotifications,
  officeInquiries,
  unreadOfficeCount,
} from '../../../inquiries/_store';
import { emptyDashboard, seedDashboard } from '../_fixtures';
import { agencyContext, agencyNotFound } from '../_store';

/**
 * GET /api/v1/agencies/mine/dashboard — aggregate for the console home and the sidebar badges:
 * listing counts, 7-day views, new 내놓기·구하기 requests, the 문의함 (`inquiries`: unread count +
 * the latest 3 written inquiries, like the API), expiring listings and listings whose 실매물 확인
 * is due. AGENT / AGENCY_OWNER of an approved agency. Dev: `?_empty=1` (or the dev-state switch)
 * returns the empty states.
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
  // The shell reads this on every console page: the seeded 문의 notifications join the feed here.
  ensureInquiryNotifications(ctx.role);
  const empty = ctx.state.emptyDashboard || req.nextUrl.searchParams.get('_empty') === '1';
  if (empty) return mockJson({ ...emptyDashboard(), inquiries: { unreadCount: 0, items: [] } });
  // The feeds are the first rows of the inbox mocks, in their own shapes (agencyDealRequestSchema,
  // AgencyInquiryView) — the console home and the inbox then name a row the same way.
  const requests = [...inboxRequests()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const fresh = requests.filter((r) => stageOf(r) === 'NEW');
  const messages = officeInquiries().filter((i) => i.channel === 'MESSAGE');
  return mockJson({
    ...seedDashboard(),
    dealRequests: {
      newCount: fresh.length,
      newSellCount: fresh.filter((r) => r.type === 'SELL_OR_LEASE').length,
      newWantedCount: fresh.filter((r) => r.type === 'WANTED').length,
      items: requests.slice(0, 4).map((r) => agencyRequestDto(r)),
    },
    inquiries: {
      unreadCount: unreadOfficeCount(),
      items: messages.slice(0, 3).map((i) => agencyInquiryView(i)),
    },
  });
}
