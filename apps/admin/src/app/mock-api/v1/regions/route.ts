import { DEFAULT_SGG_CODE, DEFAULT_REGION_NAME } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson } from '@/lib/mock';
import { REGIONS } from './_fixtures';

/**
 * GET /api/v1/regions?parentCode → shared `RegionView[]` (a bare array, complexes module):
 * children of `parentCode`, by default the 읍면동 / 지구 of the service 시군구. `parentName` is a
 * mock-only extra the admin pickers use for 지구 rows ("해룡면 신대지구").
 */
export async function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 60);
  const parent = req.nextUrl.searchParams.get('parentCode') ?? DEFAULT_SGG_CODE;
  return mockJson(
    REGIONS.filter((r) => r.code.startsWith(parent)).map((r) => ({
      code: r.code,
      name: r.name,
      fullName: `${DEFAULT_REGION_NAME} ${r.parentName ? `${r.parentName} ` : ''}${r.name}`,
      level: r.code.length > 8 ? 'RI' : 'EMD',
      parentCode: parent,
      lat: r.lat,
      lng: r.lng,
      isActive: true,
      parentName: r.parentName,
    })),
  );
}
