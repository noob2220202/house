import { parseYoutubeVideoId } from '@house/shared';
import { NextResponse, type NextRequest } from 'next/server';
import { videoPatchSchema } from '@/features/m-content/api/inputs';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import {
  audit,
  changedOnly,
  db,
  pickChanged,
  withComplexName,
} from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

type Ctx = { params: Promise<{ id: string }> };
const missing = () => mockNotFound('VIDEO_NOT_FOUND', '영상을 찾을 수 없습니다.');

// PATCH /api/v1/admin/videos/:id
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const row = db().videos.find((v) => v.id === id);
  if (!row) return missing();
  const input = await mockBody(req, videoPatchSchema);
  if (isResponse(input)) return input;
  const patch: Partial<typeof row> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.regionCode !== undefined) patch.regionCode = input.regionCode || null;
  if (input.complexId !== undefined) patch.complexId = input.complexId || null;
  if (input.isPublished !== undefined) patch.isPublished = input.isPublished;
  if (input.youtubeUrl !== undefined && input.youtubeUrl !== row.youtubeUrl) {
    const videoId = parseYoutubeVideoId(input.youtubeUrl) ?? '';
    patch.youtubeUrl = input.youtubeUrl;
    patch.youtubeVideoId = videoId;
    patch.thumbnailUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }
  const before = pickChanged(row, patch);
  const after = changedOnly(row, patch);
  Object.assign(row, patch, { updatedAt: nowIso() });
  if (patch.isPublished !== undefined && 'isPublished' in after)
    row.publishedAt = row.isPublished ? nowIso() : null;
  if (Object.keys(after).length > 0)
    audit(ctx, req, {
      action: 'video.update',
      resourceType: 'LocalVideo',
      resourceId: id,
      resourceLabel: row.title,
      before,
      after,
    });
  return mockJson(withComplexName(row));
}

// DELETE /api/v1/admin/videos/:id
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const store = db();
  const row = store.videos.find((v) => v.id === id);
  if (!row) return missing();
  store.videos = store.videos.filter((v) => v.id !== id);
  audit(ctx, req, {
    action: 'video.delete',
    resourceType: 'LocalVideo',
    resourceId: id,
    resourceLabel: row.title,
    before: { title: row.title, youtubeVideoId: row.youtubeVideoId },
  });
  return new NextResponse(null, { status: 204 });
}
