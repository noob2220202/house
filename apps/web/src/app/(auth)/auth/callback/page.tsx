import { redirect } from 'next/navigation';
import { CallbackError } from '@/features/w-auth/components/callback/CallbackError';
import { CallbackLanding } from '@/features/w-auth/components/callback/CallbackLanding';
import { AuthTopBar } from '@/features/w-auth/components/shell/AuthShell';
import {
  loginPath,
  parseIntent,
  parseProvider,
  resolveCallbackTarget,
  safeNext,
} from '@/features/w-auth/lib/flow';
import { oauthErrorInfo } from '@/features/w-auth/lib/oauth-errors';
import { getServerSession } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '로그인 확인',
  path: '/auth/callback',
  noindex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * OAuth landing of a successful login: this is the `returnTo` we send to
 * /auth/oauth/{provider}/start, so the backend comes back here with the session cookie set. The
 * session is verified on the server, then the member moves on to the agency application (중개사
 * 회원) or the page they came from. Failures never land here (the backend sends them to
 * `/login?error=`, first-time members to `/signup?provider=`); a stray `?error=` is forwarded.
 */
export default async function AuthCallbackPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '');
  const intent = parseIntent(sp.intent, next);
  const provider = parseProvider(sp.provider);
  const errorParam = typeof sp.error === 'string' ? sp.error : undefined;
  if (errorParam) redirect(`/login?${new URLSearchParams({ error: errorParam.slice(0, 60) })}`);

  const user = await getServerSession();
  if (!user) {
    return (
      <>
        <AuthTopBar />
        <CallbackError
          info={oauthErrorInfo('NO_SESSION')}
          provider={provider}
          retryHref={loginPath({ returnTo: next, intent })}
        />
      </>
    );
  }

  return (
    <>
      <AuthTopBar />
      <CallbackLanding
        target={resolveCallbackTarget({ next, intent, provider, user })}
        provider={provider}
      />
    </>
  );
}
