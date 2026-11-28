import type { NextRequest } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import {
  forcedFailure,
  inquiryNotFound,
  memberGuard,
  myInquiries,
  myInquiryDetail,
} from '../../../inquiries/_store';

/**
 * GET /api/v1/me/inquiries/:id — one of the member's inquiries with its thread
 * (`MyInquiryDetail`); reading it marks the office's replies read (`customerReadAt`). Someone
 * else's inquiry answers 404.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const g = memberGuard(req);
  if (g.fail) return g.fail;
  await mockDelay(req, 150);
  const forced = forcedFailure(req);
  if (forced) return forced;
  const { id } = await ctx.params;
  const found = myInquiries(g.role).find((i) => i.id === id);
  if (!found) return inquiryNotFound();
  found.customerReadAt = new Date().toISOString();
  return mockJson(myInquiryDetail(found));
}
