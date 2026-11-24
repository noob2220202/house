import { AdminRole } from '@house/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ADMIN_ROUTES } from '@/config/nav';
import { AuditLogsView } from '@/features/m-content/settings/AuditLogsView';
import { requireAdmin } from '@/lib/auth/server';

export const metadata: Metadata = { title: '작업 기록' };

export default async function AuditLogsPage() {
  await requireAdmin(ADMIN_ROUTES.auditLogs, AdminRole.ADMIN);
  return (
    <Suspense>
      <AuditLogsView />
    </Suspense>
  );
}
