import { ADMIN_ROLE_RANK, AdminRole, ROLE_LABEL } from '@house/shared';
import { z } from 'zod';

/**
 * Current admin as returned by GET /api/v1/admin/auth/me.
 * ASSUMED SHAPE (the auth module is not implemented yet) — see docs/frontend-integration/foundation.md.
 */
export const adminUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: z.enum(AdminRole),
  /** True once the TOTP step of this session is verified. */
  mfaVerified: z.boolean().default(true),
  lastLoginAt: z.string().nullable().optional(),
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
