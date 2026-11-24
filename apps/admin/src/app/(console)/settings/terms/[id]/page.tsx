import { AdminRole } from '@house/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { TermsEditor } from '@/features/m-content/settings/TermsEditor';
import { requireAdmin } from '@/lib/auth/server';

export const metadata: Metadata = { title: '약관' };

export default async function TermsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdmin(`${ADMIN_ROUTES.terms}/${id}`, AdminRole.ADMIN);
  return (
    <Suspense>
      <TermsEditor id={id} />
    </Suspense>
  );
}
