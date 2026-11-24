import 'server-only';
import { AdminRole } from '@house/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ApiError } from '@/lib/api/errors';
import { serverGetAuthed } from '@/lib/api/server';
import { ADMIN_SESSION_COOKIE, loginUrl } from './routes';
import { adminUserSchema, hasAdminRole, type AdminUser } from './types';

/** Server-side admin session check (authoritative; middleware only looks at cookie presence). */
export async function getServerAdmin(): Promise<AdminUser | null> {
  const jar = await cookies();
  if (!jar.get(ADMIN_SESSION_COOKIE)) return null;
  try {
    return await serverGetAuthed('/admin/auth/me', { schema: adminUserSchema });
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.isUnauthenticated || error.isForbidden || error.isNotFound)
    )
      return null;
    throw error;
  }
}

/**
 * Guard for back-office layouts/pages: redirects to /login when signed out (or TOTP not verified),
 * and to the dashboard when the admin's role is below `min`.
 */
export async function requireAdmin(
  returnTo = '/',
  min: AdminRole = AdminRole.OPERATOR,
): Promise<AdminUser> {
  const admin = await getServerAdmin();
  if (!admin || !admin.mfaVerified) redirect(loginUrl(returnTo));
  if (!hasAdminRole(admin, min)) redirect('/?denied=1');
  return admin;
}
