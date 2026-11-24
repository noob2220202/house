import { complexPhotosInputSchema } from '@house/shared';
import type { NextRequest } from 'next/server';
import { complexPhotoViews, findComplex } from '@/features/m-content/mock/complex-view';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit } from '@/features/m-content/mock/store';
import { mockError, mockJson, mockNotFound } from '@/lib/mock';
import { getMedia } from '../../../media/_store';

/**
 * PUT /api/v1/admin/complexes/:id/photos { items: [{ mediaId, caption? }] } → ComplexPhotoView[]
 * (`complexPhotosInputSchema`, at most 30, no duplicates). Replaces the whole photo list: the
 * order of `items` is the display order (first = 대표 사진); left-out photos are removed. Files are
 * uploaded first with POST /admin/media?purpose=COMPLEX_PHOTO.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const complex = findComplex(id);
  if (!complex) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');
  const input = await mockBody(req, complexPhotosInputSchema);
  if (isResponse(input)) return input;
  const known = new Map(complex.photos.map((p) => [p.mediaId, p]));
  const rows = [];
  for (const [i, item] of input.items.entries()) {
    const existing = known.get(item.mediaId);
    const media = existing ? null : getMedia(item.mediaId);
    if (!existing && !media)
      return mockError(400, 'MEDIA_NOT_USABLE', '사용할 수 없는 파일입니다.', [
        { path: `items.${i}.mediaId`, message: '사용할 수 없는 파일입니다.' },
      ]);
    rows.push({
      id: existing?.id ?? item.mediaId,
      mediaId: item.mediaId,
      url: existing?.url ?? media!.url,
      width: existing?.width ?? media?.width ?? null,
      height: existing?.height ?? media?.height ?? null,
      caption: item.caption?.trim() || null,
      sortOrder: i,
    });
  }
  const before = { photoCount: complex.photos.length };
  complex.photos = rows;
  complex.updatedAt = nowIso();
  audit(ctx, req, {
    action: 'complex.photos.set',
    resourceType: 'Complex',
    resourceId: id,
    resourceLabel: complex.name,
    before,
    after: { photoCount: rows.length },
  });
  return mockJson(complexPhotoViews(complex));
}
