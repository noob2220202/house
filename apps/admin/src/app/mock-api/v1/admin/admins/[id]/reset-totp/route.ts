import type { NextRequest } from 'next/server';
import { isResponse, mockAdmin } from '@/features/m-content/mock/http';
import { audit, db } from '@/features/m-content/mock/store';
import { mockJson, mockNotFound } from '@/lib/mock';

// POST /api/v1/admin/admins/:id/reset-totp — ASSUMED: clears the TOTP secret + recovery codes so
// the admin enrols a new authenticator at the next login; existing sessions are destroyed.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await mockAdmin(req, { min: 'SUPER_ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const { id } = await params;
  const row = db().admins.find((a) => a.id === id);
  if (!row) return mockNotFound('ADMIN_NOT_FOUND', '관리자 계정을 찾을 수 없습니다.');
  const before = { totpEnabled: row.totpEnabled };
  row.totpEnabled = false;
  row.lockedUntil = null;
  audit(ctx, req, {
    action: 'admin.reset_totp',
    resourceType: 'AdminUser',
    resourceId: id,
    resourceLabel: `${row.name} (${row.email})`,
    before,
    after: { totpEnabled: false },
  });
  return mockJson(row);
}
