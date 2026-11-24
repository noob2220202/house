import type { NextRequest } from 'next/server';
import { mockAdminRole, mockGuard, mockJson, mockUnauthenticated } from '@/lib/mock';
import { MOCK_ADMINS } from '../_fixtures';

// GET /api/v1/admin/auth/me — current admin, 401 when signed out.
export function GET(req: NextRequest) {
  const off = mockGuard();
  if (off) return off;
  const role = mockAdminRole(req);
  if (!role) return mockUnauthenticated();
  return mockJson(MOCK_ADMINS[role]);
}
