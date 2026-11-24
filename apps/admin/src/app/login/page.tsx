import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { env } from '@/config/env';
import { LoginScreen } from '@/features/m-core/components/login/LoginScreen';
import { loginReasonMessage } from '@/features/m-core/lib/session';
import { safeReturnTo } from '@/lib/auth/routes';
import { getServerAdmin } from '@/lib/auth/server';

export const metadata: Metadata = {
  title: '로그인',
  description: '관리자 계정으로 로그인합니다. 이메일 · 비밀번호 · 2단계 인증(TOTP).',
};

/**
 * Admin login: email + password, then TOTP (verification, or first-time authenticator enrolment
 * with a locally rendered QR code). Already signed-in admins go straight to their target.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[]; reason?: string | string[] }>;
}) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const target = safeReturnTo(one(sp.returnTo), '/');
  const returnTo = target.startsWith('/login') ? '/' : target;

  const admin = await getServerAdmin().catch(() => null);
  if (admin?.mfaVerified) redirect(returnTo);

  return (
    <LoginScreen
      returnTo={returnTo}
      notice={loginReasonMessage(one(sp.reason))}
      mock={env.apiMock}
    />
  );
}
