import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockRequireAdmin } from '@/lib/mock';
import { mockSummary } from './_fixtures';
import {
  remoteDealRequests,
  remotePendingAgencies,
  remotePendingSites,
  remoteReports,
  remoteVisitors,
} from './_remote';
import { resetMockCoreState } from './_store';

/**
 * GET /api/v1/admin/dashboard — counters for the shell (sidebar badges, bell, social-login status)
 * and the dashboard KPI row. `?_reset=1` (mock only) restores the initial notification fixtures.
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const auth = mockRequireAdmin(req);
  if (!('role' in auth)) return auth;
  if (req.nextUrl.searchParams.get('_reset') === '1') resetMockCoreState();
  const [pending, visitors, dealRequests, reports, pendingSites] = await Promise.all([
    remotePendingAgencies(req),
    remoteVisitors(req),
    remoteDealRequests(req),
    remoteReports(req),
    remotePendingSites(req),
    mockDelay(req, 80),
  ]);
  return mockJson(mockSummary({ pending, visitors, dealRequests, reports, pendingSites }));
}
