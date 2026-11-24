import { AUTH_PROVIDER_SLUG, type AuthProvider } from '@house/shared';
import { API_BASE_PATH } from '@/lib/api/config';
import { safeReturnTo } from './paths';

export {
  AGENT_OPEN_PATHS,
  PROTECTED_PREFIXES,
  SESSION_COOKIE,
  isProtectedPath,
  loginUrl,
  safeReturnTo,
} from './paths';

/**
 * OAuth start URL — ALWAYS a full-page navigation (`<a href>` / `location.assign`), never fetch.
 * Backend route: GET /api/v1/auth/oauth/{kakao|naver|google}/start?returnTo=<path>
 */
export function oauthStartUrl(provider: AuthProvider, returnTo?: string): string {
  const target = safeReturnTo(returnTo, '/');
  return `${API_BASE_PATH}/auth/oauth/${AUTH_PROVIDER_SLUG[provider]}/start?returnTo=${encodeURIComponent(target)}`;
}
