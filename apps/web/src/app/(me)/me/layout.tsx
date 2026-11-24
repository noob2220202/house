import type { ReactNode } from 'react';
import { MeAuthFallback } from '@/features/w-me/components/MeAuthFallback';
import { MeShell } from '@/features/w-me/components/MeShell';
import { getMeSession } from '@/features/w-me/server';

/**
 * /me/** — signed-in users only. The middleware checks the cookie; each page validates the session
 * with `requireMe(<its own path>)` / `requireUser(…)` so an expired session returns to the exact
 * page after login. The layout only draws the shell; without a valid session it renders the page
 * bare (whose guard redirects on the server) plus a client-side fallback redirect.
 */
export default async function MeLayout({ children }: { children: ReactNode }) {
  const user = await getMeSession();
  if (!user || user.signupCompleted === false)
    return (
      <>
        {children}
        <MeAuthFallback />
      </>
    );
  return <MeShell user={user}>{children}</MeShell>;
}
