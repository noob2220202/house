import { AssetType } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { mockRegionLanding } from '../../../_data';

type Ctx = { params: Promise<{ code: string }> };

const TYPES = new Set<string>(Object.values(AssetType));

// GET /api/v1/seo/regions/:code/landing?assetTypes — public (seo module): facts of one landing page.
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 80);
  const { code } = await ctx.params;
  if (!/^\d{8}(\d{2})?$/.test(code)) {
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'code', message: '올바른 지역코드가 아닙니다.' },
    ]);
  }
  const raw = (req.nextUrl.searchParams.get('assetTypes') ?? '').split(',').filter(Boolean);
  if (raw.some((t) => !TYPES.has(t))) {
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'assetTypes', message: '알 수 없는 매물 종류입니다.' },
    ]);
  }
  const landing = mockRegionLanding(code, raw as AssetType[]);
  if (!landing) return mockNotFound('REGION_NOT_FOUND', '지역을 찾을 수 없습니다.');
  return mockJson(landing);
}
