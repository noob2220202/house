import type { NextRequest } from 'next/server';
import { adminPasswordResetSchema } from '@/features/m-content/api/inputs';
import { isResponse, mockAdmin, mockBody } from '@/features/m-content/mock/http';
import { audit, db } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

// POST /api/v1/admin/admins/:id/reset-password { password } — ASSUMED: sets a temporary password
// (never stored or logged by the mock), unlocks the account and destroys its sessions.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await mockAdmin(req, { min: 'SUPER_ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const row = db().admins.find((a) => a.id === id);
  if (!row) return mockNotFound('ADMIN_NOT_FOUND', '관리자 계정을 찾을 수 없습니다.');
  const input = await mockBody(req, adminPasswordResetSchema);
  if (isResponse(input)) return input;
  row.lockedUntil = null;
  audit(ctx, req, {
    action: 'admin.reset_password',
    resourceType: 'AdminUser',
    resourceId: id,
    resourceLabel: `${row.name} (${row.email})`,
  });
  return mockJson(row);
}
