import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson } from '@/lib/mock';
import { HOME_SUMMARY } from '../_fixtures';

// GET /api/v1/home/summary — ASSUMED endpoint (docs/frontend-integration/w-home.md): site-wide
// counters + district clusters for the home hero. Public, cacheable.
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 60);
  return mockJson(HOME_SUMMARY);
}
