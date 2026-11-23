/** Auth-module constants. Redis keys are auto-prefixed with REDIS_KEY_PREFIX. */

/** OAuth state (+ nonce, PKCE verifier) lifetime: the user has this long at the provider. */
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;
/** Pending social signup (profile captured at callback, completed by POST /auth/signup). */
export const PENDING_SIGNUP_TTL_SECONDS = 30 * 60;
/** Pre-TOTP admin session: only good for the TOTP setup/verify endpoints. */
export const ADMIN_PRE_MFA_IDLE_TTL_SECONDS = 10 * 60;
/** Unconfirmed TOTP enrollment secret. */
export const TOTP_SETUP_TTL_SECONDS = 10 * 60;

export const ADMIN_MAX_FAILED_ATTEMPTS = 5;
export const ADMIN_LOCK_MINUTES = 15;
export const RECOVERY_CODE_COUNT = 10;
export const TOTP_ISSUER = 'House Admin';

/** Withdrawn members' PII is scrubbed after this grace period (abuse handling / disputes). */
export const PII_SCRUB_DELAY_DAYS = 30;
/** 탈퇴 후 재가입 제한: the same social account cannot sign up again for this long. */
export const REJOIN_COOLDOWN_DAYS = 30;

/** Cookies owned by the auth module (session cookies are COOKIE_NAMES in @house/shared). */
export const AUTH_COOKIES = {
  /** Binds an OAuth state to the browser that started the flow (login-CSRF defence). */
  OAUTH_BINDING: 'house_oauth',
  /** Opaque handle of a pending social signup. */
  PENDING_SIGNUP: 'house_signup',
} as const;

export const AUTH_COOKIE_PATHS = {
  OAUTH_BINDING: '/api/v1/auth/oauth',
  PENDING_SIGNUP: '/api/v1/auth/signup',
} as const;

/** Frontend routes (apps/web) the OAuth callback redirects to. */
export const WEB_PATHS = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  ACCOUNT: '/my/account',
} as const;

export const REDIS_KEYS = {
  oauthState: (state: string) => `auth:oauth-state:${state}`,
  pendingSignup: (hash: string) => `auth:signup:${hash}`,
  totpSetup: (adminId: string) => `auth:totp-setup:${adminId}`,
  /** One accepted code per (admin, secret, time-step); `secretTag` keeps a fresh secret usable. */
  totpUsedStep: (adminId: string, secretTag: string, step: number) =>
    `auth:totp-used:${adminId}:${secretTag}:${step}`,
} as const;

/** Dedicated queue (not the shared `cleanup` queue, so no other processor can take these jobs). */
export const AUTH_QUEUE = 'auth-maintenance';
export const AUTH_JOBS = { PII_SCRUB: 'pii-scrub' } as const;
