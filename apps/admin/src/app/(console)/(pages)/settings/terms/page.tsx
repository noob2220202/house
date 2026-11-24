import { AdminRole } from '@house/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { TermsView } from '@/features/m-content/settings/TermsView';
import { requireAdmin } from '@/lib/auth/server';

export const metadata: Metadata = { title: '약관·정책' };

export default async function TermsPage() {
  await requireAdmin(ADMIN_ROUTES.terms, AdminRole.ADMIN);
  return (
    <Suspense>
      <TermsView />
    </Suspense>
  );
}
