import type { NextRequest } from 'next/server';
import { isResponse, mockAdmin } from '@/features/m-content/mock/http';
import { adminView, audit, db } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

// POST /api/v1/admin/admins/:id/unlock → AdminAccountView — lifts a second-factor lockout.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await mockAdmin(req, { min: 'SUPER_ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const row = db().admins.find((a) => a.id === id);
  if (!row) return mockNotFound('ADMIN_NOT_FOUND', '관리자 계정을 찾을 수 없습니다.');
  const before = { lockedUntil: row.lockedUntil };
  row.lockedUntil = null;
  audit(ctx, req, {
    action: 'admin-account.unlock',
    resourceType: 'AdminUser',
    resourceId: id,
    resourceLabel: `${row.name} (${row.email})`,
    before,
    after: { lockedUntil: null },
  });
  return mockJson(adminView(row));
}
