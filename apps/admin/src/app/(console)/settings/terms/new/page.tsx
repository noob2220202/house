import { AdminRole } from '@house/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { TermsEditor } from '@/features/m-content/settings/TermsEditor';
import { requireAdmin } from '@/lib/auth/server';

export const metadata: Metadata = { title: '새 약관 작성' };

export default async function TermsCreatePage() {
  await requireAdmin(`${ADMIN_ROUTES.terms}/new`, AdminRole.ADMIN);
  return (
    <Suspense>
      <TermsEditor />
    </Suspense>
  );
}
