import { AdminRole } from '@house/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { AdminsView } from '@/features/m-content/settings/AdminsView';
import { requireAdmin } from '@/lib/auth/server';

export const metadata: Metadata = { title: '관리자 계정' };

export default async function AdminsPage() {
  // CRUD /admin/admins is SUPER_ADMIN only.
  await requireAdmin(ADMIN_ROUTES.admins, AdminRole.SUPER_ADMIN);
  return (
    <Suspense>
      <AdminsView />
    </Suspense>
  );
}
