"use strict";
/** Auth-module constants. Redis keys are auto-prefixed with REDIS_KEY_PREFIX. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_JOBS = exports.AUTH_QUEUE = exports.REDIS_KEYS = exports.WEB_PATHS = exports.AUTH_COOKIE_PATHS = exports.AUTH_COOKIES = exports.TERMS_CONSENT_OK_TTL_SECONDS = exports.SUSPENDED_WITHDRAW_TTL_SECONDS = exports.SUSPENDED_PII_RETENTION_DAYS = exports.REJOIN_COOLDOWN_DAYS = exports.PII_SCRUB_DELAY_DAYS = exports.TOTP_ISSUER = exports.RECOVERY_CODE_COUNT = exports.ADMIN_LOCK_MINUTES = exports.ADMIN_MAX_FAILED_ATTEMPTS = exports.ADMIN_CLIENT_LOCK_SECONDS = exports.ADMIN_PASSWORD_FAILURE_WINDOW_SECONDS = exports.ADMIN_MAX_PASSWORD_FAILURES = exports.TOTP_SETUP_TTL_SECONDS = exports.ADMIN_PRE_MFA_IDLE_TTL_SECONDS = exports.PENDING_SIGNUP_TTL_SECONDS = exports.OAUTH_STATE_TTL_SECONDS = void 0;
/** OAuth state (+ nonce, PKCE verifier) lifetime: the user has this long at the provider. */
exports.OAUTH_STATE_TTL_SECONDS = 10 * 60;
/** Pending social signup (profile captured at callback, completed by POST /auth/signup). */
exports.PENDING_SIGNUP_TTL_SECONDS = 30 * 60;
/** Pre-TOTP admin session: only good for the TOTP setup/verify endpoints. */
exports.ADMIN_PRE_MFA_IDLE_TTL_SECONDS = 10 * 60;
/** Unconfirmed TOTP enrollment secret. */
exports.TOTP_SETUP_TTL_SECONDS = 10 * 60;
/** Wrong passwords per (admin, client IP bucket) within the window before that pair is locked. */
exports.ADMIN_MAX_PASSWORD_FAILURES = 5;
exports.ADMIN_PASSWORD_FAILURE_WINDOW_SECONDS = 15 * 60;
exports.ADMIN_CLIENT_LOCK_SECONDS = 15 * 60;
/** Second-factor failures (the caller knew the password) before the whole account is locked. */
exports.ADMIN_MAX_FAILED_ATTEMPTS = 5;
exports.ADMIN_LOCK_MINUTES = 15;
exports.RECOVERY_CODE_COUNT = 10;
exports.TOTP_ISSUER = 'House Admin';
/** Withdrawn members' PII is scrubbed after this grace period (abuse handling / disputes). */
exports.PII_SCRUB_DELAY_DAYS = 30;
/** 탈퇴 후 재가입 제한: the same social account cannot sign up again for this long. */
exports.REJOIN_COOLDOWN_DAYS = 30;
/**
 * A member who withdraws while suspended: PII is kept this long (dispute / abuse handling, stated
 * in the 개인정보처리방침) instead of PII_SCRUB_DELAY_DAYS, and the rejoin cooldown is as long, so
 * withdrawing does not shed the suspension any sooner. Moderation evidence (reports, audit rows)
 * is kept as usual.
 */
exports.SUSPENDED_PII_RETENTION_DAYS = 90;
/** Withdrawal ticket of a suspended member (issued at the refused social login, single use). */
exports.SUSPENDED_WITHDRAW_TTL_SECONDS = 10 * 60;
/** "This member agreed to the current required terms" cache (positive results only). */
exports.TERMS_CONSENT_OK_TTL_SECONDS = 60 * 60;
/** Cookies owned by the auth module (session cookies are COOKIE_NAMES in @house/shared). */
exports.AUTH_COOKIES = {
    /** Binds an OAuth state to the browser that started the flow (login-CSRF defence). */
    OAUTH_BINDING: 'house_oauth',
    /** Opaque handle of a pending social signup. */
    PENDING_SIGNUP: 'house_signup',
    /** Withdrawal ticket of a suspended member (POST /auth/withdraw). */
    SUSPENDED_WITHDRAW: 'house_withdraw',
};
exports.AUTH_COOKIE_PATHS = {
    OAUTH_BINDING: '/api/v1/auth/oauth',
    PENDING_SIGNUP: '/api/v1/auth/signup',
    SUSPENDED_WITHDRAW: '/api/v1/auth/withdraw',
};
/** Frontend routes (apps/web) the OAuth callback redirects to. */
exports.WEB_PATHS = {
    HOME: '/',
    LOGIN: '/login',
    SIGNUP: '/signup',
    /** 내 계정 (apps/web `/me/account`, D11): identity-link results land here. */
    ACCOUNT: '/me/account',
};
exports.REDIS_KEYS = {
    oauthState: (state) => `auth:oauth-state:${state}`,
    pendingSignup: (hash) => `auth:signup:${hash}`,
    suspendedWithdraw: (hash) => `auth:suspended-withdraw:${hash}`,
    termsConsentOk: (userId, currentRequiredDigest) => `auth:terms-ok:${userId}:${currentRequiredDigest}`,
    totpSetup: (adminId) => `auth:totp-setup:${adminId}`,
    /** Wrong-password counter of one (admin, client IP bucket); ≥ the max means that pair is locked. */
    adminPasswordFailures: (adminId, ipBucket) => `auth:admin-pw-fail:${adminId}:${ipBucket}`,
    /** One accepted code per (admin, secret, time-step); `secretTag` keeps a fresh secret usable. */
    totpUsedStep: (adminId, secretTag, step) => `auth:totp-used:${adminId}:${secretTag}:${step}`,
};
/** Dedicated queue (not the shared `cleanup` queue, so no other processor can take these jobs). */
exports.AUTH_QUEUE = 'auth-maintenance';
exports.AUTH_JOBS = { PII_SCRUB: 'pii-scrub' };
//# sourceMappingURL=auth.constants.js.map