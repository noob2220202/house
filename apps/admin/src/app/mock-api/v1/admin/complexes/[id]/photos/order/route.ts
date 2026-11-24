import { NextResponse, type NextRequest } from 'next/server';
import { orderSchema } from '@/features/m-content/api/inputs';
import { findComplex } from '@/features/m-content/mock/complex-view';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit } from '@/features/m-content/mock/store';
import { mockNotFound } from '@/lib/mock';

// PUT /api/v1/admin/complexes/:id/photos/order { ids } — ASSUMED: sortOrder 0…n-1 (first = cover)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const complex = findComplex(id);
  if (!complex) return mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');
  const input = await mockBody(req, orderSchema);
  if (isResponse(input)) return input;
  input.ids.forEach((photoId, index) => {
    const photo = complex.photos.find((p) => p.id === photoId);
    if (photo) photo.sortOrder = index;
  });
  complex.updatedAt = nowIso();
  audit(ctx, req, {
    action: 'complex.photo.reorder',
    resourceType: 'Complex',
    resourceId: id,
    resourceLabel: complex.name,
    after: { order: input.ids },
  });
  return new NextResponse(null, { status: 204 });
}
