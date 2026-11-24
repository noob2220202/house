import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { findComplexSpec, toComplexDetail } from '../_fixtures';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/complexes/:id — public 단지 detail with 평형 + photos (complexes module).
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const { id } = await ctx.params;
  const spec = findComplexSpec(id);
  if (!spec) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');
  return mockJson(toComplexDetail(spec));
}
