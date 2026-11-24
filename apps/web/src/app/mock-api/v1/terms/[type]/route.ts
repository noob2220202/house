import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { MOCK_TERMS } from '../_fixtures';

// GET /api/v1/terms/:type — current document of one type (SERVICE | PRIVACY | LOCATION | MARKETING) with content. Public.
export async function GET(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 250);
  if (req.nextUrl.searchParams.get('_fail') === '1')
    return mockError(500, 'INTERNAL_ERROR', '일시적인 오류가 발생했습니다.');
  const { type } = await ctx.params;
  const doc = MOCK_TERMS.find((d) => d.type === type.toUpperCase());
  return doc ? mockJson(doc) : mockNotFound('NOT_FOUND', '약관을 찾을 수 없습니다.');
}
