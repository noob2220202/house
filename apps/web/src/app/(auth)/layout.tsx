import type { ReactNode } from 'react';
import { AuthShell } from '@/features/w-auth/components/shell/AuthShell';

/**
 * Auth pages (login, OAuth landing, signup completion, farewell) use a minimal chrome: no site
 * header or bottom tab bar, only the mini footer of Login.dc.html.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
