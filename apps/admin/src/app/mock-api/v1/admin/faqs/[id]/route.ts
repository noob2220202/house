import { NextResponse, type NextRequest } from 'next/server';
import { faqPatchSchema } from '@/features/m-content/api/inputs';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit, changedOnly, db, pickChanged } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

type Ctx = { params: Promise<{ id: string }> };
const missing = () => mockNotFound('FAQ_NOT_FOUND', 'FAQ를 찾을 수 없습니다.');

// PATCH /api/v1/admin/faqs/:id
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const store = db();
  const row = store.faqs.find((f) => f.id === id);
  if (!row) return missing();
  const patch = await mockBody(req, faqPatchSchema);
  if (isResponse(patch)) return patch;
  const before = pickChanged(row, patch);
  const after = changedOnly(row, patch);
  if (patch.category && patch.category !== row.category) {
    // Moving to another category appends the item to its end.
    row.sortOrder =
      Math.max(
        0,
        ...store.faqs.filter((f) => f.category === patch.category).map((f) => f.sortOrder),
      ) + 1;
  }
  Object.assign(row, patch, { updatedAt: nowIso() });
  if (Object.keys(after).length > 0)
    audit(ctx, req, {
      action: 'faq.update',
      resourceType: 'Faq',
      resourceId: id,
      resourceLabel: row.question,
      before,
      after,
    });
  return mockJson(row);
}

// DELETE /api/v1/admin/faqs/:id
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const store = db();
  const row = store.faqs.find((f) => f.id === id);
  if (!row) return missing();
  store.faqs = store.faqs.filter((f) => f.id !== id);
  audit(ctx, req, {
    action: 'faq.delete',
    resourceType: 'Faq',
    resourceId: id,
    resourceLabel: row.question,
    before: { category: row.category, question: row.question },
  });
  return new NextResponse(null, { status: 204 });
}
