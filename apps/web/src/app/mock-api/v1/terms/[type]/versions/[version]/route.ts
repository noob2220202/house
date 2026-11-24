import type { NextRequest } from 'next/server';
import { mockDelay, mockGuard, mockJson, mockNotFound } from '@/lib/mock';
import { termsTypeOf, versionsOf } from '../_fixtures';

// GET /api/v1/terms/:type/versions/:version — ASSUMED: one specific version with its content.
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; version: string }> },
) {
  const off = mockGuard();
  if (off) return off;
  await mockDelay(req);
  const { type: raw, version } = await ctx.params;
  const type = termsTypeOf(raw);
  const doc = type ? versionsOf(type).find((d) => d.version === version) : undefined;
  if (!doc) return mockNotFound('TERMS_NOT_FOUND', '약관을 찾을 수 없습니다.');
  return mockJson(doc);
}
