import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockRequireAdmin } from '@/lib/mock';
import { mockQueues } from '../_fixtures';
import {
  remoteDealRequests,
  remoteExpiringAds,
  remotePendingAgencies,
  remotePendingSites,
  remoteReports,
} from '../_remote';

/**
 * GET /api/v1/admin/dashboard/queues — pending agencies, 사무소 홈페이지 requests, recent deal
 * requests, reports, expiring ads.
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const auth = mockRequireAdmin(req);
  if (!('role' in auth)) return auth;
  const [pending, expiring, dealRequests, reports, pendingSites] = await Promise.all([
    remotePendingAgencies(req),
    remoteExpiringAds(req),
    remoteDealRequests(req),
    remoteReports(req),
    remotePendingSites(req),
    mockDelay(req, 200),
  ]);
  return mockJson(mockQueues({ pending, expiring, dealRequests, reports, pendingSites }));
}
