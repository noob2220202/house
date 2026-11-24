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
import { AUTH_ROUTES } from '@/features/w-auth/routes';
import { getServerSession } from '@/lib/auth/server';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: '로그인 확인',
  path: '/auth/callback',
  noindex: true,
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * OAuth landing. The backend's provider callback redirects here (this is the `returnTo` we send to
 * /auth/oauth/{provider}/start) on success, and with `?error=<code>` on failure.
 * Success: the session is verified on the server, then the user moves on to the unfinished signup,
 * the agency application (중개사 회원) or the page they came from.
 */
export default async function AuthCallbackPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNext(sp.next, '');
  const intent = parseIntent(sp.intent, next);
  const provider = parseProvider(sp.provider);
  const retryHref = loginPath({ returnTo: next, intent });
  const errorParam = typeof sp.error === 'string' ? sp.error : undefined;

  if (errorParam) {
    // `link=1`: the round trip was 계정 설정 → 연결하기 (ASSUMED backend contract, see w-auth.md).
    const info = oauthErrorInfo(errorParam, { linking: sp.link === '1' });
    return (
      <>
        <AuthTopBar />
        <CallbackError
          info={info}
          provider={provider}
          retryHref={info.linking ? AUTH_ROUTES.account : retryHref}
        />
      </>
    );
  }

  const user = await getServerSession();
  if (!user) {
    return (
      <>
        <AuthTopBar />
        <CallbackError
          info={oauthErrorInfo('NO_SESSION')}
          provider={provider}
          retryHref={retryHref}
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
