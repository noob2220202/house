import { NextResponse, type NextRequest } from 'next/server';
import { complexPhotoPatchSchema } from '@/features/m-content/api/inputs';
import { findComplex } from '@/features/m-content/mock/complex-view';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

type Ctx = { params: Promise<{ id: string; photoId: string }> };
const missing = () => mockNotFound('COMPLEX_PHOTO_NOT_FOUND', '사진을 찾을 수 없습니다.');

// PATCH /api/v1/admin/complexes/:id/photos/:photoId { caption }
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id, photoId } = await params;
  const complex = findComplex(id);
  const row = complex?.photos.find((p) => p.id === photoId);
  if (!complex || !row) return missing();
  const input = await mockBody(req, complexPhotoPatchSchema);
  if (isResponse(input)) return input;
  const before = { caption: row.caption };
  row.caption = input.caption?.trim() || null;
  complex.updatedAt = nowIso();
  audit(ctx, req, {
    action: 'complex.photo.update',
    resourceType: 'Complex',
    resourceId: id,
    resourceLabel: complex.name,
    before,
    after: { caption: row.caption },
  });
  return mockJson(row);
}

// DELETE /api/v1/admin/complexes/:id/photos/:photoId
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id, photoId } = await params;
  const complex = findComplex(id);
  const row = complex?.photos.find((p) => p.id === photoId);
  if (!complex || !row) return missing();
  const before = { photoCount: complex.photos.length };
  complex.photos = complex.photos
    .filter((p) => p.id !== photoId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p, index) => ({ ...p, sortOrder: index }));
  complex.updatedAt = nowIso();
  audit(ctx, req, {
    action: 'complex.photo.remove',
    resourceType: 'Complex',
    resourceId: id,
    resourceLabel: complex.name,
    before,
    after: { photoCount: complex.photos.length },
  });
  return new NextResponse(null, { status: 204 });
}
