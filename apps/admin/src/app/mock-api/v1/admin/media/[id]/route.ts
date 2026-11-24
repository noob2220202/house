import type { NextRequest } from 'next/server';
import { mockDelay, mockError, mockGuard, mockJson, mockRequireAdmin } from '@/lib/mock';
import { mediaDto } from '../_store';

// GET /api/v1/admin/media/:id → AdminMediaView (subset). The ads editor polls it after an upload
// until the image is READY (the public GET /media/:id answers 404 before that).
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const off = mockGuard();
  if (off) return off;
  const admin = mockRequireAdmin(req);
  if (!('role' in admin)) return admin;
  await mockDelay(req, 80);
  const media = mediaDto((await ctx.params).id);
  return media ? mockJson(media) : mockError(404, 'MEDIA_NOT_FOUND', '파일을 찾을 수 없습니다.');
}
