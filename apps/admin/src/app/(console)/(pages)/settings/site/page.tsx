import { AdminRole } from '@house/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { SiteSettingsView } from '@/features/m-content/settings/SiteSettingsView';
import { requireAdmin } from '@/lib/auth/server';

export const metadata: Metadata = { title: '사이트 정보' };

export default async function SiteSettingsPage() {
  // GET/PUT /admin/site-settings/:key is ADMIN and above.
  await requireAdmin(ADMIN_ROUTES.siteInfo, AdminRole.ADMIN);
  return (
    <Suspense>
      <SiteSettingsView />
    </Suspense>
  );
}
