import { AdminRole } from '@house/shared';
import type { Metadata } from 'next';
import { ADMIN_ROUTES } from '@/config/nav';
import { HomeEditorView } from '@/features/m-content/home/HomeEditorView';
import { requireAdmin } from '@/lib/auth/server';

export const metadata: Metadata = { title: '메인 화면 편집' };

export default async function HomeEditorPage() {
  // Stored as a site setting → ADMIN and above (GET/PUT /admin/site-settings/:key).
  await requireAdmin(ADMIN_ROUTES.homeEditor, AdminRole.ADMIN);
  return <HomeEditorView />;
}
