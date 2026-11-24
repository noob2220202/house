import type { NextRequest, NextResponse } from 'next/server';
import { mockDelay, mockJson } from '@/lib/mock';
import { listingsContext, summarize } from '../_store';

/**
 * GET /api/v1/agency/listings/summary (ASSUMED) → `{ total, byStatus: { DRAFT, ACTIVE, RESERVED,
 * CLOSED, HIDDEN }, verificationDue, expiringSoon, coBrokered }` for the status tabs and reminders.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const ctx = listingsContext(req);
  if ('status' in ctx) return ctx;
  await mockDelay(req, 150);
  return mockJson(summarize(ctx.state));
}
