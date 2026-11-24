import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson } from '@/lib/mock';
import { mockSitemapRows } from '../../_data';

type Ctx = { params: Promise<{ kind: string }> };

// GET /api/v1/seo/sitemap/:kind (complexes | listings | agencies) — public (seo module).
export async function GET(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req, 60);
  const { kind } = await ctx.params;
  if (kind !== 'complexes' && kind !== 'listings' && kind !== 'agencies') {
    return mockError(400, 'VALIDATION_FAILED', '입력값을 확인해 주세요.', [
      { path: 'kind', message: '알 수 없는 사이트맵입니다.' },
    ]);
  }
  return mockJson(mockSitemapRows(kind));
}
