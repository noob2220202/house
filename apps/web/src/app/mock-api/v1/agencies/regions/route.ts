import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson } from '@/lib/mock';
import { AGENCY_REGIONS, AGENCY_SUMMARIES } from '../_fixtures';

// GET /api/v1/agencies/regions — 읍면동 facet (code, name, office count) for the 지역 filter. ASSUMED.
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 80);
  return mockJson({ total: AGENCY_SUMMARIES.length, items: AGENCY_REGIONS });
}
