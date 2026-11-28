import type { NextRequest } from 'next/server';
import { mockDelay, mockJson, mockPaginate } from '@/lib/mock';
import { forcedFailure, memberGuard, myInquiries, myInquiryItem } from '../../inquiries/_store';

/**
 * GET /api/v1/me/inquiries?page&pageSize — the member's written inquiries (`MyInquiryListItem`),
 * newest activity first; inquiries the office deleted are left out. Dev: `?_empty=1`, `?_fail=1`.
 */
export async function GET(req: NextRequest) {
  const g = memberGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 200);
  const forced = forcedFailure(req);
  if (forced) return forced;
  const rows = req.nextUrl.searchParams.get('_empty') === '1' ? [] : myInquiries(g.role);
  return mockJson(mockPaginate(rows.map(myInquiryItem), req, { pageSize: 10 }));
}
