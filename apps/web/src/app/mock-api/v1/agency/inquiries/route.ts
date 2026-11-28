import { agencyInquiryListQuerySchema, type InquiryStatus } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import {
  agencyInquiryView,
  ensureInquiryNotifications,
  forcedFailure,
  officeInquiries,
  unreadOfficeCount,
  validationFailed,
} from '../../inquiries/_store';
import { agencyGuard } from '../deal-requests/_store';

/**
 * GET /api/v1/agency/inquiries?status&channel&source&unread&q&page&pageSize — the 문의함 of the
 * mock office (`AgencyInquiryPage`): written inquiries and logged contact events, newest
 * `lastMessageAt` first. `statusCounts` counts the rows matching the other filters (the status
 * tabs); `unreadCount` is the office-wide badge. Dev: `?_empty=1`, `?_fail=1`.
 */
export async function GET(req: NextRequest) {
  const g = agencyGuard(req);
  if (g.fail) return g.fail;
  ensureInquiryNotifications(g.role);
  await mockDelay(req, 250);
  const forced = forcedFailure(req);
  if (forced) return forced;

  const sp = req.nextUrl.searchParams;
  const query = Object.fromEntries([...sp].filter(([k]) => !k.startsWith('_')));
  const parsed = agencyInquiryListQuerySchema.safeParse(query);
  if (!parsed.success) return validationFailed(parsed.error.issues);
  const f = parsed.data;
  const empty = sp.get('_empty') === '1';
  const q = f.q?.toLowerCase();
  const faceted = (empty ? [] : officeInquiries()).filter(
    (i) =>
      (!f.channel || i.channel === f.channel) &&
      (!f.source || i.source === f.source) &&
      (!f.unread || !i.readAt) &&
      (!q ||
        [
          i.listing?.title,
          i.customerName,
          i.customerPhone,
          i.message,
          ...i.messages.map((m) => m.body),
        ].some((t) => t?.toLowerCase().includes(q))),
  );
  const statusCounts: Record<InquiryStatus, number> = { NEW: 0, IN_PROGRESS: 0, DONE: 0 };
  for (const i of faceted) statusCounts[i.status] += 1;
  const rows = faceted.filter((i) => !f.status || i.status === f.status);
  return mockJson({
    ...mockPaginate(
      rows.map((i) => agencyInquiryView(i)),
      req,
      { pageSize: f.pageSize },
    ),
    unreadCount: empty ? 0 : unreadOfficeCount(),
    statusCounts,
  });
}
