import { complexTradesQuerySchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockNotFound, mockPaginate } from '@/lib/mock';
import { findComplexSpec, tradeDataOf } from '../../_fixtures';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/complexes/:id/trades?dealType&areaTypeId&fromYm&toYm&page&pageSize — public,
// newest first (complexes module, `complexTradesQuerySchema`).
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const { id } = await ctx.params;
  const spec = findComplexSpec(id);
  if (!spec) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');

  const parsed = complexTradesQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return mockError(
      400,
      'VALIDATION_FAILED',
      '요청 값이 올바르지 않습니다.',
      parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  const q = parsed.data;
  const rows = tradeDataOf(spec).trades.filter(
    (t) =>
      (!q.dealType || t.dealType === q.dealType) &&
      (!q.areaTypeId || t.areaTypeId === q.areaTypeId) &&
      (!q.fromYm || t.dealYm >= q.fromYm) &&
      (!q.toYm || t.dealYm <= q.toYm),
  );
  return mockJson(mockPaginate(rows, req, { pageSize: 20 }));
}
