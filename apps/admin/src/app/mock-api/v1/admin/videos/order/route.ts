import { NextResponse, type NextRequest } from 'next/server';
import { orderSchema } from '@/features/m-content/api/inputs';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { audit, db } from '@/features/m-content/mock/store';

// PUT /api/v1/admin/videos/order { ids } — ASSUMED: sets sortOrder 1…n in the given order.
export async function PUT(req: NextRequest) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const input = await mockBody(req, orderSchema);
  if (isResponse(input)) return input;
  const store = db();
  input.ids.forEach((id, index) => {
    const row = store.videos.find((v) => v.id === id);
    if (row) row.sortOrder = index + 1;
  });
  audit(ctx, req, {
    action: 'video.reorder',
    resourceType: 'LocalVideo',
    resourceLabel: `동네TV ${input.ids.length}개`,
    after: { order: input.ids },
  });
  return new NextResponse(null, { status: 204 });
}
