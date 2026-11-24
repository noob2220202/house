import { NextResponse, type NextRequest } from 'next/server';
import { noticePatchSchema } from '@/features/m-content/api/inputs';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit, changedOnly, db, pickChanged } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

type Ctx = { params: Promise<{ id: string }> };
const missing = () => mockNotFound('NOTICE_NOT_FOUND', '공지사항을 찾을 수 없습니다.');

// GET /api/v1/admin/notices/:id
export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req);
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const row = db().notices.find((n) => n.id === id);
  return row ? mockJson(row) : missing();
}

// PATCH /api/v1/admin/notices/:id
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const row = db().notices.find((n) => n.id === id);
  if (!row) return missing();
  const patch = await mockBody(req, noticePatchSchema);
  if (isResponse(patch)) return patch;
  const before = pickChanged(row, patch);
  const after = changedOnly(row, patch);
  const publishFlip = patch.isPublished !== undefined && patch.isPublished !== row.isPublished;
  Object.assign(row, patch, { updatedAt: nowIso() });
  if (publishFlip) row.publishedAt = row.isPublished ? (row.publishedAt ?? nowIso()) : null;
  if (Object.keys(after).length > 0)
    audit(ctx, req, {
      action: publishFlip
        ? row.isPublished
          ? 'notice.publish'
          : 'notice.unpublish'
        : 'notice.update',
      resourceType: 'Notice',
      resourceId: row.id,
      resourceLabel: row.title,
      before,
      after,
    });
  return mockJson(row);
}

// DELETE /api/v1/admin/notices/:id (soft delete in the backend)
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const store = db();
  const row = store.notices.find((n) => n.id === id);
  if (!row) return missing();
  store.notices = store.notices.filter((n) => n.id !== id);
  audit(ctx, req, {
    action: 'notice.delete',
    resourceType: 'Notice',
    resourceId: id,
    resourceLabel: row.title,
    before: { title: row.title, isPublished: row.isPublished },
  });
  return new NextResponse(null, { status: 204 });
}
