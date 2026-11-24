import type { NextRequest } from 'next/server';
import { isResponse, mockAdmin } from '@/features/m-content/mock/http';
import { db } from '@/features/m-content/mock/store';
import { mockJson, mockPaginate } from '@/lib/mock';

// GET /api/v1/admin/audit-logs?resourceType&resourceId&adminUserId&from&to&page&pageSize
// (auditLogQuerySchema) — newest first.
export async function GET(req: NextRequest) {
  const ctx = await mockAdmin(req, { min: 'ADMIN' });
  if (isResponse(ctx)) return ctx;
  const { sp } = ctx;
  const resourceType = sp.get('resourceType');
  const resourceId = sp.get('resourceId');
  const adminUserId = sp.get('adminUserId');
  const from = sp.get('from') ? new Date(sp.get('from') ?? '').getTime() : null;
  const to = sp.get('to') ? new Date(sp.get('to') ?? '').getTime() : null;
  const rows = db().audit.filter((row) => {
    const at = new Date(row.createdAt).getTime();
    return (
      (!resourceType || row.resourceType === resourceType) &&
      (!resourceId || row.resourceId === resourceId) &&
      (!adminUserId || row.adminUserId === adminUserId) &&
      (from === null || Number.isNaN(from) || at >= from) &&
      (to === null || Number.isNaN(to) || at <= to)
    );
  });
  return mockJson(mockPaginate(sp.get('_empty') === '1' ? [] : rows, req));
}
