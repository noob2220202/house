import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/nav';
import { authBarLinkClass } from '@/features/w-auth/components/shell/AuthShell.classes';
import { AuthTopBar } from '@/features/w-auth/components/shell/AuthShell';
import { SignupFlow } from '@/features/w-auth/components/signup/SignupFlow';
import {
  parseIntent,
  parseProvider,
  resolvePostLoginTarget,
  safeNext,
} from '@/features/w-auth/lib/flow';
import { getServerSession } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '회원가입',
  description: '약관 동의와 관심 지역 선택만 하면 가입이 끝나요.',
  path: '/signup',
  noindex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Signup of a first-time 카카오 / 네이버 / Google login. The backend's OAuth callback redirects here
 * (`/signup?provider=<slug>`) with a pending signup cookie and **no session**; the form loads the
 * pending signup in the browser (the cookie is scoped to /api/v1/auth/signup) and completes it with
 * POST /auth/signup. A visitor who is already signed in has nothing to sign up for.
 */
export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const returnTo = safeNext(sp.returnTo, '');
  const intent = parseIntent(sp.intent, returnTo);

  const user = await getServerSession();
  if (user) redirect(resolvePostLoginTarget({ next: returnTo, intent, user }));

  return (
    <>
      <AuthTopBar>
        <Link className={authBarLinkClass} href={ROUTES.home}>
          다음에 가입할게요
        </Link>
      </AuthTopBar>
      <SignupFlow provider={parseProvider(sp.provider)} intent={intent} />
    </>
  );
}
