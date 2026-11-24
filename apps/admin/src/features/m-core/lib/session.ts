import { ApiError } from '@/lib/api/errors';
import { loginUrl } from '@/lib/auth/routes';

/** 401 codes that are answers to a form (wrong password / code), not a lost session. */
const FORM_CODES = new Set(['AUTH_INVALID_CREDENTIALS', 'AUTH_TOTP_INVALID']);

/**
 * True when an API failure means the console session is gone (expired, revoked, logged out
 * elsewhere) — including `AUTH_TOTP_REQUIRED`: the API guard answers that for every /admin/* route
 * once a session is no longer TOTP-verified (e.g. a SUPER_ADMIN reset the authenticator), and the
 * only way forward from the console is a fresh login.
 */
export function isSessionLost(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && !FORM_CODES.has(error.code);
}

export type LoginReason = 'expired' | 'denied';

/** `/login?returnTo=…&reason=expired` — where to send the admin after the session is lost. */
export function sessionExpiredUrl(currentPath: string): string {
  const base = loginUrl(currentPath);
  return `${base}${base.includes('?') ? '&' : '?'}reason=expired`;
}

/** Notice shown on the login page for a `reason` query value. */
export function loginReasonMessage(reason: string | undefined): string | null {
  if (reason === 'expired') return '보안을 위해 세션이 만료되었습니다. 다시 로그인해 주세요.';
  return null;
}

/** Form-level message for a failed login / TOTP request. */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError))
    return '일시적인 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
  switch (error.code) {
    case 'AUTH_INVALID_CREDENTIALS':
      return '이메일 또는 비밀번호가 올바르지 않습니다.';
    case 'AUTH_ACCOUNT_LOCKED':
      return '로그인 시도가 너무 많아 계정이 잠겼습니다. 잠시 후 다시 시도하거나 최고관리자에게 문의해 주세요.';
    case 'AUTH_ACCOUNT_SUSPENDED':
      return '사용이 중지된 관리자 계정입니다. 최고관리자에게 문의해 주세요.';
    case 'AUTH_IP_NOT_ALLOWED':
      return '허용되지 않은 접속 위치입니다. 사무실 네트워크에서 다시 시도해 주세요.';
    case 'AUTH_TOTP_INVALID':
      return '인증 코드가 올바르지 않습니다. 인증 앱의 최신 코드를 입력해 주세요.';
    case 'AUTH_SESSION_EXPIRED':
    case 'UNAUTHENTICATED':
      return '로그인 시간이 초과되었습니다. 처음부터 다시 로그인해 주세요.';
    default:
      return error.message;
  }
}

/**
 * True when the half-authenticated login session is gone and the flow must restart. During the
 * TOTP step `AUTH_TOTP_REQUIRED` is the expected state of the session, not a lost one.
 */
export function mustRestartLogin(error: unknown): boolean {
  return (
    isSessionLost(error) && !(error instanceof ApiError && error.code === 'AUTH_TOTP_REQUIRED')
  );
}
