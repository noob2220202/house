import type { NextRequest } from 'next/server';
import type { InquiryStatusCounts } from '@/features/a-inbox/api/schemas';
import { mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { agencyGuard, forcedFailure } from '../deal-requests/_store';
import { inquiryStore, unreadInquiryCount } from './_store';

/**
 * GET /api/v1/agency/inquiries?status&channel&unreadOnly&q&page&pageSize (ASSUMED resource)
 * Contact log of the agency: messages customers left and contact actions (전화 · 문자 · 번호 복사)
 * on its listings / office page, newest first. `unreadCount` and `statusCounts` feed the badges.
 * Dev: `?_empty=1`, `?_fail=1`.
 */
export async function GET(req: NextRequest) {
  const g = agencyGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 250);
  const forced = forcedFailure(req);
  if (forced) return forced;

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status');
  const channel = sp.get('channel');
  const unreadOnly = sp.get('unreadOnly') === 'true' || sp.get('unreadOnly') === '1';
  const q = (sp.get('q') ?? '').trim().toLowerCase();
  const all = sp.get('_empty') === '1' ? [] : inquiryStore().items;

  const faceted = all
    .filter(
      (i) =>
        (!channel || i.channel === channel) &&
        (!unreadOnly || !i.readAt) &&
        (!q ||
          [i.listing?.title, i.customerName, i.message, i.memo].some((t) =>
            t?.toLowerCase().includes(q),
          )),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const statusCounts: InquiryStatusCounts = { NEW: 0, IN_PROGRESS: 0, DONE: 0 };
  for (const i of faceted) statusCounts[i.status] += 1;

  return mockJson({
    ...mockPaginate(
      faceted.filter((i) => !status || i.status === status),
      req,
      { pageSize: 12 },
    ),
    unreadCount: sp.get('_empty') === '1' ? 0 : unreadInquiryCount(),
    statusCounts,
  });
}
