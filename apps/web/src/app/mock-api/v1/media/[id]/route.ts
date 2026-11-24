import { NextResponse, type NextRequest } from 'next/server';
import {
  mockCsrfOk,
  mockError,
  mockGuard,
  mockJson,
  mockNotFound,
  mockSessionRole,
  mockUnauthenticated,
} from '@/lib/mock';
import { mediaDto, mediaStore } from '../_store';

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/media/:id — metadata + variant URLs
export async function GET(_req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  const { id } = await ctx.params;
  const dto = mediaDto(id);
  return dto ? mockJson(dto) : mockNotFound('MEDIA_NOT_FOUND', '파일을 찾을 수 없습니다.');
}

// DELETE /api/v1/media/:id — owner only
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const off = mockGuard();
  if (off) return off;
  if (!mockSessionRole(req)) return mockUnauthenticated();
  if (!mockCsrfOk(req)) return mockError(403, 'CSRF_FAILED', '보안 토큰이 올바르지 않습니다.');
  const { id } = await ctx.params;
  if (!mediaStore().delete(id)) return mockNotFound('MEDIA_NOT_FOUND', '파일을 찾을 수 없습니다.');
  return new NextResponse(null, { status: 204 });
}
