import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { findComplexSpec, nearbyOf } from '../../_fixtures';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/complexes/:id/nearby?limit&radius — ASSUMED endpoint (see docs/frontend-integration/w-complex.md):
// complexes around this one, nearest first, with listing counts per deal type.
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const { id } = await ctx.params;
  const spec = findComplexSpec(id);
  if (!spec) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(30, Math.max(1, Number(sp.get('limit')) || 10));
  const radius = Math.min(10_000, Math.max(100, Number(sp.get('radius')) || 3000));
  return mockJson({ items: nearbyOf(spec, radius).slice(0, limit) });
}
