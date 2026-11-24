import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { currentIdOf, termsTypeOf, versionsOf } from './_fixtures';

// GET /api/v1/terms/:type/versions — ASSUMED: every published version (newest first), no content.
export async function GET(req: NextRequest, ctx: { params: Promise<{ type: string }> }) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const { type: raw } = await ctx.params;
  const type = termsTypeOf(raw);
  if (!type) return mockNotFound('TERMS_NOT_FOUND', '약관을 찾을 수 없습니다.');
  const currentId = currentIdOf(type);
  return mockJson(
    versionsOf(type).map(({ content: _content, ...summary }) => ({
      ...summary,
      isCurrent: summary.id === currentId,
    })),
  );
}
