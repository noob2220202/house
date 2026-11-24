import { DEFAULT_SGG_CODE, RegionLevel, type RegionView } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson } from '@/lib/mock';
import { REGIONS } from '../map/_fixtures';

// GET /api/v1/regions?parentCode&level&includeInactive — public (complexes module,
// `regionListQuerySchema`) → `RegionView[]`: children of `parentCode` (default: the service 시군구).
// The fixture also lists the 신대·선월 지구 (리 level) the design names as places.
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 60);
  const parent = req.nextUrl.searchParams.get('parentCode') ?? DEFAULT_SGG_CODE;
  const rows: RegionView[] = REGIONS.filter((r) => r.code.startsWith(parent)).map((r) => ({
    code: r.code,
    name: r.name,
    fullName: [DEFAULT_REGION_NAME_SHORT, r.parentName, r.name].filter(Boolean).join(' '),
    level: r.parentName ? RegionLevel.RI : RegionLevel.EMD,
    parentCode: r.parentName ? r.code.slice(0, 8) : DEFAULT_SGG_CODE,
    lat: r.lat,
    lng: r.lng,
    isActive: true,
  }));
  return mockJson(rows);
}

const DEFAULT_REGION_NAME_SHORT = '순천시';
