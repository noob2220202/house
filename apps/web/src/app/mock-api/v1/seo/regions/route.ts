import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson } from '@/lib/mock';
import { mockRegionIndex } from '../_data';

// GET /api/v1/seo/regions — public (seo module): 읍면동/리 with listings, 단지 or 아파트 실거래.
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 60);
  return mockJson(mockRegionIndex());
}
