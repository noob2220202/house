import { AUTH_PROVIDER_SLUG, AuthProvider, authProviderFromSlug } from '@house/shared';
import { ROUTES } from '@/config/nav';
import { oauthStartUrl, safeReturnTo } from '@/lib/auth/routes';
import { isAgent, type SessionUser } from '@/lib/auth/types';
import { AUTH_ROUTES } from '../routes';

/** Which kind of member is signing in: 일반 회원 or 중개사 회원 (→ agency application after login). */
export type LoginIntent = 'user' | 'agent';

/** Backend limit for `returnTo` (oauthStartQuerySchema) — longer values are rejected. */
const RETURN_TO_MAX = 500;
/** Pages that must never be a post-login destination (would loop or make no sense). */
const AUTH_PAGE_PREFIXES = [ROUTES.login, ROUTES.signup, '/auth'] as const;

type Param = string | string[] | null | undefined;
const first = (v: Param): string | undefined => (Array.isArray(v) ? v[0] : (v ?? undefined));

/** `?as=agent` / `?intent=agent` → 'agent'; a return target inside the broker console also implies it. */
export function parseIntent(value: Param, returnTo?: string | null): LoginIntent {
  const v = first(value);
  if (v === 'agent') return 'agent';
  if (v === 'user') return 'user';
  return returnTo && (returnTo === ROUTES.agent || returnTo.startsWith(`${ROUTES.agent}/`))
    ? 'agent'
    : 'user';
}

/** Lowercase provider slug from a query param, or undefined when it is not 카카오/네이버/Google. */
export function parseProvider(value: Param): AuthProvider | undefined {
  const v = first(value);
  return v ? (authProviderFromSlug(v.toLowerCase()) ?? undefined) : undefined;
}

const PROBE_ORIGIN = 'http://same.origin';

/**
 * Resolves dot segments and percent-encoded separators the way a browser would ("/..//evil.com"
 * → "//evil.com") and returns the normalized path, or null when the result is not a plain
 * same-origin path (protocol-relative, other origin, unparsable).
 */
function normalizePath(target: string): string | null {
  try {
    const url = new URL(target, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN || url.pathname.startsWith('//')) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Site-relative target that is safe to land on after login (never an auth page). */
export function safeNext(value: Param, fallback: string = ROUTES.home): string {
  const checked = safeReturnTo(first(value), fallback);
  if (checked === fallback) return fallback;
  const target = normalizePath(checked);
  if (!target) return fallback;
  const path = target.split(/[?#]/)[0] ?? target;
  return AUTH_PAGE_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)) ? fallback : target;
}

export interface FlowParams {
  /** Where the user wanted to go before logging in. */
  returnTo?: string | null;
  intent?: LoginIntent;
  provider?: AuthProvider;
}

function withQuery(path: string, params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `${path}?${qs}` : path;
}

function flowQuery({ returnTo, intent, provider }: FlowParams, nextKey: 'next' | 'returnTo') {
  const next = safeNext(returnTo, '');
  return {
    [nextKey]: next && next !== ROUTES.home ? next : undefined,
    provider: provider ? AUTH_PROVIDER_SLUG[provider] : undefined,
    intent: intent === 'agent' ? 'agent' : undefined,
  };
}

/**
 * The path handed to the backend as `returnTo` when OAuth starts: our landing page, carrying the
 * final destination (`next`), the provider (for the "최근 사용" hint) and the member intent.
 * Falls back to dropping `next` when the result would exceed the backend's 500-char limit.
 */
export function buildCallbackPath(params: FlowParams): string {
  const full = withQuery(AUTH_ROUTES.callback, flowQuery(params, 'next'));
  if (full.length <= RETURN_TO_MAX) return full;
  return withQuery(AUTH_ROUTES.callback, flowQuery({ ...params, returnTo: null }, 'next'));
}

/** Full-page navigation URL that starts the OAuth flow and comes back through /auth/callback. */
export function oauthLoginUrl(provider: AuthProvider, params: Omit<FlowParams, 'provider'> = {}) {
  return oauthStartUrl(provider, buildCallbackPath({ ...params, provider }));
}

/**
 * Full-page navigation URL that links one more provider to the signed-in account
 * (`intent=link`). The backend comes back to 계정 설정 with `?linked=<slug>` on success and
 * `?error=<code>` on failure.
 */
export function oauthLinkUrl(provider: AuthProvider): string {
  return `${oauthStartUrl(provider, AUTH_ROUTES.account)}&intent=link`;
}

export function loginPath(params: Omit<FlowParams, 'provider'> = {}): string {
  const q = flowQuery(params, 'returnTo');
  return withQuery(ROUTES.login, { returnTo: q.returnTo, as: q.intent });
}

export function signupPath(params: FlowParams = {}): string {
  return withQuery(ROUTES.signup, flowQuery(params, 'returnTo'));
}

/**
 * Where a signed-in user goes after login / signup completion.
 * - 중개사 intent: existing agents → broker console (or their target), everyone else → agency application.
 * - 일반 intent: the requested page, or home.
 */
export function resolvePostLoginTarget({
  next,
  intent = 'user',
  user,
}: {
  next?: string | null;
  intent?: LoginIntent;
  user?: Pick<SessionUser, 'role'> | null;
}): string {
  const target = safeNext(next, ROUTES.home);
  if (intent !== 'agent') return target;
  if (!isAgent(user)) return ROUTES.agentApply;
  return target === ROUTES.home ? ROUTES.agent : target;
}

/**
 * Destination after the OAuth landing. `signupCompleted` is always true for a backend session (a
 * session exists only after POST /auth/signup); the check stays for older session payloads.
 */
export function resolveCallbackTarget({
  next,
  intent = 'user',
  provider,
  user,
}: {
  next?: string | null;
  intent?: LoginIntent;
  provider?: AuthProvider;
  user: Pick<SessionUser, 'role'> & { signupCompleted?: boolean };
}): string {
  if (user.signupCompleted === false) return signupPath({ returnTo: next, intent, provider });
  return resolvePostLoginTarget({ next, intent, user });
}

/**
 * Reads the `returnTo` the backend kept with a pending signup (POST /auth/signup answers it): it is
 * the landing path we sent at OAuth start (`/auth/callback?next=…&intent=agent`), or a plain path.
 * Returns the final destination and the member intent it carries.
 */
export function parseSignupReturnTo(returnTo: string | null | undefined): {
  next: string;
  intent: LoginIntent;
} {
  const checked = safeReturnTo(returnTo, '');
  const landing = checked ? normalizePath(checked) : null;
  if (!landing) return { next: '', intent: 'user' };
  const url = new URL(landing, PROBE_ORIGIN);
  if (url.pathname !== AUTH_ROUTES.callback) {
    const next = safeNext(landing, '');
    return { next, intent: parseIntent(undefined, next) };
  }
  const next = safeNext(url.searchParams.get('next'), '');
  return { next, intent: parseIntent(url.searchParams.get('intent'), next) };
}

export const PROVIDERS: readonly AuthProvider[] = [
  AuthProvider.KAKAO,
  AuthProvider.NAVER,
  AuthProvider.GOOGLE,
];
