import { AdminRole } from '@house/shared';
import type { Metadata } from 'next';
import { ADMIN_ROUTES } from '@/config/nav';
import { SocialLoginView } from '@/features/m-content/settings/SocialLoginView';
import { requireAdmin } from '@/lib/auth/server';

export const metadata: Metadata = { title: '간편로그인 연동' };

export default async function SocialLoginPage() {
  await requireAdmin(ADMIN_ROUTES.socialLogin, AdminRole.ADMIN);
  return <SocialLoginView />;
}
