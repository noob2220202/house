import { NextResponse, type NextRequest } from 'next/server';
import { orderSchema } from '@/features/m-content/api/inputs';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { audit, db } from '@/features/m-content/mock/store';

// PUT /api/v1/admin/faqs/order { ids } — ASSUMED: sets sortOrder 1…n in the given order
// (the ids of one category; other rows are untouched).
export async function PUT(req: NextRequest) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const input = await mockBody(req, orderSchema);
  if (isResponse(input)) return input;
  const store = db();
  input.ids.forEach((id, index) => {
    const row = store.faqs.find((f) => f.id === id);
    if (row) row.sortOrder = index + 1;
  });
  const first = store.faqs.find((f) => f.id === input.ids[0]);
  audit(ctx, req, {
    action: 'faq.reorder',
    resourceType: 'Faq',
    resourceLabel: first ? `${first.category} 분류 ${input.ids.length}개` : null,
    after: { order: input.ids },
  });
  return new NextResponse(null, { status: 204 });
}
