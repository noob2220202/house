import type { MockAdminRole } from '@/lib/mock';

/** Mock admins per role (fictional). Shape = shared `AdminMeResponse` (GET /admin/auth/me). */
export const MOCK_ADMINS: Record<MockAdminRole, Record<string, unknown>> = {
  SUPER_ADMIN: {
    id: '0a000000-0000-4000-8000-000000000001',
    email: 'super@example.com',
    name: '정다은',
    role: 'SUPER_ADMIN',
    totpEnabled: true,
    recoveryCodesRemaining: 10,
    lastLoginIp: '203.0.113.10',
    lastLoginAt: '2026-11-23T05:20:00.000Z',
  },
  ADMIN: {
    id: '0a000000-0000-4000-8000-000000000002',
    email: 'admin@example.com',
    name: '한지우',
    role: 'ADMIN',
    totpEnabled: true,
    recoveryCodesRemaining: 10,
    lastLoginIp: '203.0.113.10',
    lastLoginAt: '2026-11-23T01:02:00.000Z',
  },
  OPERATOR: {
    id: '0a000000-0000-4000-8000-000000000003',
    email: 'operator@example.com',
    name: '운영자',
    role: 'OPERATOR',
    totpEnabled: true,
    recoveryCodesRemaining: 10,
    lastLoginIp: '203.0.113.10',
    lastLoginAt: '2026-11-22T08:40:00.000Z',
  },
};
