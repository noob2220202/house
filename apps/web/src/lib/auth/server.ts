import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { serverGetAuthed } from '@/lib/api/server';
import { ApiError } from '@/lib/api/errors';
import { SESSION_COOKIE, loginUrl, signupUrl } from './paths';
import { isAgent, sessionUserSchema, type SessionUser } from './types';

/**
 * Server-side session check (the authoritative one — middleware only looks at cookie presence).
 * Makes the route dynamic. Returns null when signed out.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  if (!jar.get(SESSION_COOKIE)) return null;
  try {
    return await serverGetAuthed('/auth/me', { schema: sessionUserSchema });
  } catch (error) {
    if (error instanceof ApiError && (error.isUnauthenticated || error.isNotFound)) return null;
    throw error;
  }
}

/**
 * Use in protected server pages/layouts: redirects to /login?returnTo=… when signed out, and to the
 * signup completion (required terms) when the account has not finished signing up yet.
 */
export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getServerSession();
  if (!user) redirect(loginUrl(returnTo));
  if (user.signupCompleted === false) redirect(signupUrl(returnTo));
  return user;
}

/** Broker console guard: AGENT / AGENCY_OWNER only; other users go to the agency application page. */
export async function requireAgent(returnTo: string): Promise<SessionUser> {
  const user = await requireUser(returnTo);
  if (!isAgent(user)) redirect('/agent/apply');
  return user;
}
