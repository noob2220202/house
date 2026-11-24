import { NextResponse, type NextRequest } from 'next/server';
import { adminPatchSchema } from '@/features/m-content/api/inputs';
import { isResponse, mockAdmin, mockBody, mockConflict } from '@/features/m-content/mock/http';
import { audit, changedOnly, db, pickChanged } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

type Ctx = { params: Promise<{ id: string }> };
const missing = () => mockNotFound('ADMIN_NOT_FOUND', '관리자 계정을 찾을 수 없습니다.');
const activeSupers = (exceptId: string) =>
  db().admins.filter((a) => a.id !== exceptId && a.role === 'SUPER_ADMIN' && a.status === 'ACTIVE');

// PATCH /api/v1/admin/admins/:id { name?, role?, status?, ipAllowlist? } — ASSUMED body
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { min: 'SUPER_ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const row = db().admins.find((a) => a.id === id);
  if (!row) return missing();
  const patch = await mockBody(req, adminPatchSchema);
  if (isResponse(patch)) return patch;
  const demotes = patch.role !== undefined && patch.role !== 'SUPER_ADMIN';
  const disables = patch.status === 'DISABLED';
  if (id === ctx.actor.id && (demotes || disables))
    return mockConflict('ADMIN_SELF_CHANGE', '본인 계정의 권한과 상태는 바꿀 수 없습니다.');
  if (row.role === 'SUPER_ADMIN' && (demotes || disables) && activeSupers(id).length === 0)
    return mockConflict('ADMIN_LAST_SUPER_ADMIN', '최고관리자는 한 명 이상 있어야 합니다.');
  const before = pickChanged(row, patch);
  const after = changedOnly(row, patch);
  Object.assign(row, patch);
  if (Object.keys(after).length > 0)
    audit(ctx, req, {
      action: 'admin.update',
      resourceType: 'AdminUser',
      resourceId: id,
      resourceLabel: `${row.name} (${row.email})`,
      before,
      after,
    });
  return mockJson(row);
}

// DELETE /api/v1/admin/admins/:id
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const ctx = await mockAdmin(req, { min: 'SUPER_ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const store = db();
  const row = store.admins.find((a) => a.id === id);
  if (!row) return missing();
  if (id === ctx.actor.id)
    return mockConflict('ADMIN_SELF_CHANGE', '본인 계정은 삭제할 수 없습니다.');
  if (row.role === 'SUPER_ADMIN' && activeSupers(id).length === 0)
    return mockConflict('ADMIN_LAST_SUPER_ADMIN', '최고관리자는 한 명 이상 있어야 합니다.');
  store.admins = store.admins.filter((a) => a.id !== id);
  audit(ctx, req, {
    action: 'admin.delete',
    resourceType: 'AdminUser',
    resourceId: id,
    resourceLabel: `${row.name} (${row.email})`,
    before: { email: row.email, role: row.role, status: row.status },
  });
  return new NextResponse(null, { status: 204 });
}
