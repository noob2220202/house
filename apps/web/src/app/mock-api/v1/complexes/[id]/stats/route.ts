import { complexStatsQuerySchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { areaTypeIdOf, findComplexSpec } from '../../_fixtures';
import { toStatsView } from '../../_wire';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/complexes/:id/stats?dealType&areaTypeId&months — public (complexes module,
// `complexStatsQuerySchema`) → `ComplexStatsView` { series[], overall[], latest[] }: with
// `areaTypeId` only that 평형's series (overall empty), otherwise every series + the overall trend.
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const { id } = await ctx.params;
  const spec = findComplexSpec(id);
  if (!spec) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');

  const parsed = complexStatsQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return mockError(
      400,
      'VALIDATION_FAILED',
      '요청 값이 올바르지 않습니다.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const q = parsed.data;
  if (q.areaTypeId && !spec.areas.some((a) => areaTypeIdOf(spec.code, a) === q.areaTypeId)) {
    return mockNotFound('COMPLEX_AREA_TYPE_NOT_FOUND', '평형 정보를 찾을 수 없습니다.');
  }
  return mockJson(toStatsView(spec, q.dealType, q.areaTypeId ?? null, q.months));
}
