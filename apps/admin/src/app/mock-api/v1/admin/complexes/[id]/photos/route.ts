import type { NextRequest } from 'next/server';
import { complexPhotoInputSchema } from '@/features/m-content/api/inputs';
import { findComplex } from '@/features/m-content/mock/complex-view';
import { isResponse, mockAdmin, mockBody, mockConflict } from '@/features/m-content/mock/http';
import { newId, nowIso } from '@/features/m-content/mock/ids';
import { audit } from '@/features/m-content/mock/store';
import { mockError, mockJson, mockNotFound } from '@/lib/mock';
import { getMedia } from '../../../media/_store';

const MAX_PHOTOS = 20;

// POST /api/v1/admin/complexes/:id/photos { mediaId, caption? } — ASSUMED sub-path.
// The file is uploaded first with POST /admin/media?purpose=COMPLEX_PHOTO.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const complex = findComplex(id);
  if (!complex) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');
  const input = await mockBody(req, complexPhotoInputSchema);
  if (isResponse(input)) return input;
  const media = getMedia(input.mediaId);
  if (!media) return mockError(400, 'MEDIA_NOT_USABLE', '사용할 수 없는 파일입니다.');
  if (complex.photos.some((p) => p.mediaId === input.mediaId))
    return mockConflict('COMPLEX_PHOTO_EXISTS', '이미 등록된 사진입니다.');
  if (complex.photos.length >= MAX_PHOTOS)
    return mockConflict('COMPLEX_PHOTO_LIMIT', `사진은 ${MAX_PHOTOS}장까지 등록할 수 있습니다.`);
  const row = {
    id: newId(),
    mediaId: media.id,
    url: media.url,
    width: media.width,
    height: media.height,
    caption: input.caption?.trim() || null,
    sortOrder: Math.max(-1, ...complex.photos.map((p) => p.sortOrder)) + 1,
  };
  const before = { photoCount: complex.photos.length };
  complex.photos.push(row);
  complex.updatedAt = nowIso();
  audit(ctx, req, {
    action: 'complex.photo.add',
    resourceType: 'Complex',
    resourceId: id,
    resourceLabel: complex.name,
    before,
    after: { photoCount: complex.photos.length },
  });
  return mockJson(row, { status: 201 });
}
