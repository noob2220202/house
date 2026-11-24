import { ADMIN_ROLE_RANK, AdminRole, ROLE_LABEL } from '@house/shared';
import { z } from 'zod';

/**
 * Current admin as returned by GET /api/v1/admin/auth/me (shared `AdminMeResponse`). The endpoint
 * only answers TOTP-verified sessions (401 `AUTH_TOTP_REQUIRED` otherwise), so `mfaVerified` is
 * not part of the response: a parsed admin is always verified.
 */
export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(AdminRole),
  /** Always true for a session that could read /admin/auth/me (kept for the server guards). */
  mfaVerified: z.boolean().default(true),
  totpEnabled: z.boolean().default(true),
  /** One-time recovery codes not used yet (of the 10 issued at enrolment). */
  recoveryCodesRemaining: z.number().int().min(0).default(0),
  lastLoginAt: z.string().nullable().default(null),
  lastLoginIp: z.string().nullable().default(null),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/** `hasAdminRole(admin, AdminRole.ADMIN)` → that rank or higher. */
export function hasAdminRole(
  admin: Pick<AdminUser, 'role'> | null | undefined,
  min: AdminRole = AdminRole.OPERATOR,
): boolean {
  return !!admin && ADMIN_ROLE_RANK[admin.role] >= ADMIN_ROLE_RANK[min];
}

export function adminRoleLabel(role: AdminRole): string {
  return ROLE_LABEL[role];
}
