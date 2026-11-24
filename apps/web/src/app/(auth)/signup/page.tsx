import { redirect } from 'next/navigation';
import { termsListSchema, type TermsDocument } from '@/features/w-auth/api';
import { LogoutLink } from '@/features/w-auth/components/shell/LogoutLink';
import { AuthTopBar } from '@/features/w-auth/components/shell/AuthShell';
import { SignupFlow } from '@/features/w-auth/components/signup/SignupFlow';
import {
  loginPath,
  parseIntent,
  parseProvider,
  resolvePostLoginTarget,
  safeNext,
  signupPath,
} from '@/features/w-auth/lib/flow';
import { ApiError } from '@/lib/api';
import { serverGet } from '@/lib/api/server';
import { getServerSession } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '회원가입',
  description: '약관 동의와 관심 지역 선택만 하면 가입이 끝나요.',
  path: '/signup',
  noindex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadTerms(): Promise<TermsDocument[] | null> {
  try {
    return await serverGet('/terms', { schema: termsListSchema, revalidate: 300, tags: ['terms'] });
  } catch (error) {
    if (error instanceof ApiError) return null; // the client shows an error state with retry
    throw error;
  }
}

/**
 * Signup completion for a user who just authenticated with 카카오 / 네이버 / Google for the first
 * time (`signupCompleted=false`): terms consents, nickname, 관심 지역.
 */
export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const returnTo = safeNext(sp.returnTo, '');
  const intent = parseIntent(sp.intent, returnTo);
  const provider = parseProvider(sp.provider);

  const user = await getServerSession();
  // Not signed in: signing up = logging in with a social account first.
  if (!user) redirect(loginPath({ returnTo: signupPath({ returnTo, intent }), intent }));
  const target = resolvePostLoginTarget({ next: returnTo, intent, user });
  if (user.signupCompleted !== false) redirect(target);

  const terms = await loadTerms();
  return (
    <>
      <AuthTopBar>
        <LogoutLink />
      </AuthTopBar>
      <SignupFlow
        account={{ nickname: user.nickname, name: user.name, email: user.email }}
        provider={provider}
        intent={intent}
        target={target}
        initialTerms={terms}
      />
    </>
  );
}
