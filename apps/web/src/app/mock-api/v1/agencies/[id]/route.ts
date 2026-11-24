import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { findAgencyDetail, toAgencyProfileWire } from '../_fixtures';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/agencies/:id — public office profile (approved offices only) → `AgencyProfile`.
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  if (req.nextUrl.searchParams.get('_fail') === '1')
    return mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.');
  const { id } = await ctx.params;
  const agency = findAgencyDetail(id);
  if (!agency) return mockNotFound('AGENCY_NOT_FOUND', '중개사무소를 찾을 수 없습니다.');
  return mockJson(toAgencyProfileWire(agency));
}
