import type { Metadata } from 'next';
import { AccountView } from '@/features/m-core/components/account/AccountView';

export const metadata: Metadata = { title: '내 계정' };

/** 계정 · 2단계 인증 (topbar account menu). Open to every admin role. */
export default function AccountPage() {
  return <AccountView />;
}
