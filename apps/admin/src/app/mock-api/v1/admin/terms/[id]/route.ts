import { NextResponse, type NextRequest } from 'next/server';
import { termsPatchSchema } from '@/features/m-content/api/inputs';
import { isResponse, mockAdmin, mockBody, mockConflict } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit, changedOnly, db, pickChanged, termsView } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

type Ctx = { params: Promise<{ id: string }> };
const missing = () => mockNotFound('TERMS_NOT_FOUND', '약관을 찾을 수 없습니다.');
const locked = () =>
  mockConflict('TERMS_ALREADY_PUBLISHED', '게시된 약관은 수정하거나 삭제할 수 없습니다.');

// GET /api/v1/admin/terms/:id
export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { min: 'ADMIN' });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const row = db().terms.find((t) => t.id === id);
  return row ? mockJson(termsView(row)) : missing();
}

// PATCH /api/v1/admin/terms/:id — drafts only (published versions are immutable)
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { min: 'ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const store = db();
  const row = store.terms.find((t) => t.id === id);
  if (!row) return missing();
  if (row.publishedAt) return locked();
  const patch = await mockBody(req, termsPatchSchema);
  if (isResponse(patch)) return patch;
  if (
    patch.version &&
    store.terms.some((t) => t.id !== id && t.type === row.type && t.version === patch.version)
  )
    return mockConflict('TERMS_VERSION_EXISTS', '같은 버전의 약관이 이미 있습니다.');
  const before = pickChanged(row, patch);
  const after = changedOnly(row, patch);
  Object.assign(row, patch, { updatedAt: nowIso() });
  if (Object.keys(after).length > 0)
    audit(ctx, req, {
      action: 'terms.update',
      resourceType: 'TermsDocument',
      resourceId: id,
      resourceLabel: `${row.title} ${row.version}`,
      before,
      after,
    });
  return mockJson(termsView(row));
}

// DELETE /api/v1/admin/terms/:id — drafts only
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { min: 'ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const store = db();
  const row = store.terms.find((t) => t.id === id);
  if (!row) return missing();
  if (row.publishedAt) return locked();
  store.terms = store.terms.filter((t) => t.id !== id);
  audit(ctx, req, {
    action: 'terms.delete',
    resourceType: 'TermsDocument',
    resourceId: id,
    resourceLabel: `${row.title} ${row.version}`,
    before: { type: row.type, version: row.version },
  });
  return new NextResponse(null, { status: 204 });
}
