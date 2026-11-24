import type { NextRequest } from 'next/server';
import { adminCreateSchema } from '@/features/m-content/api/inputs';
import {
  isResponse,
  matchesText,
  mockAdmin,
  mockBody,
  mockConflict,
} from '@/features/m-content/mock/http';
import { newId, nowIso } from '@/features/m-content/mock/ids';
import { audit, db } from '@/features/m-content/mock/store';
import { mockJson, mockPaginate } from '@/lib/mock';

const RANK = { SUPER_ADMIN: 3, ADMIN: 2, OPERATOR: 1 } as const;

// GET /api/v1/admin/admins?q&role&status&page&pageSize (SUPER_ADMIN)
export async function GET(req: NextRequest) {
  const ctx = await mockAdmin(req, { min: 'SUPER_ADMIN' });
  if (isResponse(ctx)) return ctx;
  const { sp } = ctx;
  const role = sp.get('role');
  const status = sp.get('status');
  const rows = db()
    .admins.filter((a) => matchesText(sp.get('q'), a.name, a.email))
    .filter((a) => (!role || a.role === role) && (!status || a.status === status))
    .sort((a, b) => RANK[b.role] - RANK[a.role] || a.createdAt.localeCompare(b.createdAt));
  return mockJson(mockPaginate(sp.get('_empty') === '1' ? [] : rows, req, { pageSize: 50 }));
}

// POST /api/v1/admin/admins { email, name, role, password } — ASSUMED body
export async function POST(req: NextRequest) {
  const ctx = await mockAdmin(req, { min: 'SUPER_ADMIN', mutate: true });
  if (isResponse(ctx)) return ctx;
  const input = await mockBody(req, adminCreateSchema);
  if (isResponse(input)) return input;
  const store = db();
  if (store.admins.some((a) => a.email.toLowerCase() === input.email.toLowerCase()))
    return mockConflict('ADMIN_EMAIL_TAKEN', '이미 등록된 이메일입니다.');
  const row = {
    id: newId(),
    email: input.email,
    name: input.name,
    role: input.role,
    status: 'ACTIVE' as const,
    totpEnabled: false,
    ipAllowlist: [],
    lockedUntil: null,
    lastLoginAt: null,
    lastLoginIp: null,
    createdAt: nowIso(),
  };
  store.admins.push(row);
  audit(ctx, req, {
    action: 'admin.create',
    resourceType: 'AdminUser',
    resourceId: row.id,
    resourceLabel: `${row.name} (${row.email})`,
    after: { email: row.email, name: row.name, role: row.role, status: row.status },
  });
  return mockJson(row, { status: 201 });
}
