import { AdminRole } from '@house/shared';
import { redirect } from 'next/navigation';
import { ADMIN_ROUTES } from '@/config/nav';
import { requireAdmin } from '@/lib/auth/server';
import { hasAdminRole } from '@/lib/auth/types';

/** 설정 has no screen of its own: ADMIN+ lands on 사이트 정보, operators on their own account. */
export default async function SettingsIndexPage() {
  const admin = await requireAdmin(ADMIN_ROUTES.settings);
  redirect(hasAdminRole(admin, AdminRole.ADMIN) ? ADMIN_ROUTES.siteInfo : '/settings/account');
}
