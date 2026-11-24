import { NextResponse, type NextRequest } from 'next/server';
import { complexPatchSchema } from '@/features/m-content/api/inputs';
import { complexDetail, findComplex } from '@/features/m-content/mock/complex-view';
import { isResponse, mockAdmin, mockBody, mockConflict } from '@/features/m-content/mock/http';
import { nowIso } from '@/features/m-content/mock/ids';
import { audit, changedOnly, db, pickChanged } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

type Ctx = { params: Promise<{ id: string }> };
const missing = () => mockNotFound('COMPLEX_NOT_FOUND', '단지를 찾을 수 없습니다.');

// GET /api/v1/admin/complexes/:id — ASSUMED (facts + areaTypes + photos + trade summary)
export async function GET(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req);
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const row = findComplex(id);
  return row ? mockJson(complexDetail(row)) : missing();
}

// PATCH /api/v1/admin/complexes/:id
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const row = findComplex(id);
  if (!row) return missing();
  const patch = await mockBody(req, complexPatchSchema);
  if (isResponse(patch)) return patch;
  if (
    patch.externalCode &&
    db().complexes.some((c) => c.id !== id && c.externalCode === patch.externalCode)
  )
    return mockConflict('COMPLEX_EXTERNAL_CODE_TAKEN', '이미 등록된 외부 코드입니다.');
  const before = pickChanged(row, patch);
  const after = changedOnly(row, patch);
  Object.assign(row, patch, { updatedAt: nowIso() });
  if (patch.emdCode) row.sggCode = patch.emdCode.slice(0, 5);
  if (Object.keys(after).length > 0)
    audit(ctx, req, {
      action: 'complex.update',
      resourceType: 'Complex',
      resourceId: id,
      resourceLabel: row.name,
      before,
      after,
    });
  return mockJson(complexDetail(row));
}

// DELETE /api/v1/admin/complexes/:id — refused while listings still point at the complex
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { min: 'ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const store = db();
  const row = findComplex(id);
  if (!row) return missing();
  if (row.activeListingCount > 0)
    return mockConflict(
      'COMPLEX_HAS_LISTINGS',
      `게시 중인 매물 ${row.activeListingCount}건이 연결되어 있어 삭제할 수 없습니다.`,
    );
  store.complexes = store.complexes.filter((c) => c.id !== id);
  audit(ctx, req, {
    action: 'complex.delete',
    resourceType: 'Complex',
    resourceId: id,
    resourceLabel: row.name,
    before: { name: row.name, emdName: row.emdName },
  });
  return new NextResponse(null, { status: 204 });
}
