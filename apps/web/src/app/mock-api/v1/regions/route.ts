import { DEFAULT_SGG_CODE } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson } from '@/lib/mock';
import { REGIONS } from '../map/_fixtures';

// GET /api/v1/regions?sggCode — ASSUMED endpoint (w-map): 읍면동 / 지구 of the city with a
// representative point, used by the map breadcrumb and its region picker.
// → { items: [{ code, name, parentName, lat, lng }] }
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 60);
  const sgg = req.nextUrl.searchParams.get('sggCode') ?? DEFAULT_SGG_CODE;
  return mockJson({ items: REGIONS.filter((r) => r.code.startsWith(sgg)) });
}
