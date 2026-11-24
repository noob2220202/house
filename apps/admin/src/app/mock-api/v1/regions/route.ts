import { DEFAULT_SGG_CODE } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson } from '@/lib/mock';
import { REGIONS } from './_fixtures';

// GET /api/v1/regions?sggCode — ASSUMED endpoint (first assumed by w-map): 읍면동 / 지구 of the city.
// Used by m-ads for the banner region-targeting picker. → { items: [{ code, name, parentName, lat, lng }] }
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 60);
  const sgg = req.nextUrl.searchParams.get('sggCode') ?? DEFAULT_SGG_CODE;
  return mockJson({ items: REGIONS.filter((r) => r.code.startsWith(sgg)) });
}
