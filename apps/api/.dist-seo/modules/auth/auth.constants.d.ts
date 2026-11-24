/** Auth-module constants. Redis keys are auto-prefixed with REDIS_KEY_PREFIX. */
/** OAuth state (+ nonce, PKCE verifier) lifetime: the user has this long at the provider. */
export declare const OAUTH_STATE_TTL_SECONDS: number;
/** Pending social signup (profile captured at callback, completed by POST /auth/signup). */
export declare const PENDING_SIGNUP_TTL_SECONDS: number;
/** Pre-TOTP admin session: only good for the TOTP setup/verify endpoints. */
export declare const ADMIN_PRE_MFA_IDLE_TTL_SECONDS: number;
/** Unconfirmed TOTP enrollment secret. */
export declare const TOTP_SETUP_TTL_SECONDS: number;
/** Wrong passwords per (admin, client IP bucket) within the window before that pair is locked. */
export declare const ADMIN_MAX_PASSWORD_FAILURES = 5;
export declare const ADMIN_PASSWORD_FAILURE_WINDOW_SECONDS: number;
export declare const ADMIN_CLIENT_LOCK_SECONDS: number;
/** Second-factor failures (the caller knew the password) before the whole account is locked. */
export declare const ADMIN_MAX_FAILED_ATTEMPTS = 5;
export declare const ADMIN_LOCK_MINUTES = 15;
export declare const RECOVERY_CODE_COUNT = 10;
export declare const TOTP_ISSUER = "House Admin";
/** Withdrawn members' PII is scrubbed after this grace period (abuse handling / disputes). */
export declare const PII_SCRUB_DELAY_DAYS = 30;
/** 탈퇴 후 재가입 제한: the same social account cannot sign up again for this long. */
export declare const REJOIN_COOLDOWN_DAYS = 30;
/**
 * A member who withdraws while suspended: PII is kept this long (dispute / abuse handling, stated
 * in the 개인정보처리방침) instead of PII_SCRUB_DELAY_DAYS, and the rejoin cooldown is as long, so
 * withdrawing does not shed the suspension any sooner. Moderation evidence (reports, audit rows)
 * is kept as usual.
 */
export declare const SUSPENDED_PII_RETENTION_DAYS = 90;
/** Withdrawal ticket of a suspended member (issued at the refused social login, single use). */
export declare const SUSPENDED_WITHDRAW_TTL_SECONDS: number;
/** "This member agreed to the current required terms" cache (positive results only). */
export declare const TERMS_CONSENT_OK_TTL_SECONDS: number;
/** Cookies owned by the auth module (session cookies are COOKIE_NAMES in @house/shared). */
export declare const AUTH_COOKIES: {
    /** Binds an OAuth state to the browser that started the flow (login-CSRF defence). */
    readonly OAUTH_BINDING: "house_oauth";
    /** Opaque handle of a pending social signup. */
    readonly PENDING_SIGNUP: "house_signup";
    /** Withdrawal ticket of a suspended member (POST /auth/withdraw). */
    readonly SUSPENDED_WITHDRAW: "house_withdraw";
};
export declare const AUTH_COOKIE_PATHS: {
    readonly OAUTH_BINDING: "/api/v1/auth/oauth";
    readonly PENDING_SIGNUP: "/api/v1/auth/signup";
    readonly SUSPENDED_WITHDRAW: "/api/v1/auth/withdraw";
};
/** Frontend routes (apps/web) the OAuth callback redirects to. */
export declare const WEB_PATHS: {
    readonly HOME: "/";
    readonly LOGIN: "/login";
    readonly SIGNUP: "/signup";
    /** 내 계정 (apps/web `/me/account`, D11): identity-link results land here. */
    readonly ACCOUNT: "/me/account";
};
export declare const REDIS_KEYS: {
    readonly oauthState: (state: string) => string;
    readonly pendingSignup: (hash: string) => string;
    readonly suspendedWithdraw: (hash: string) => string;
    readonly termsConsentOk: (userId: string, currentRequiredDigest: string) => string;
    readonly totpSetup: (adminId: string) => string;
    /** Wrong-password counter of one (admin, client IP bucket); ≥ the max means that pair is locked. */
    readonly adminPasswordFailures: (adminId: string, ipBucket: string) => string;
    /** One accepted code per (admin, secret, time-step); `secretTag` keeps a fresh secret usable. */
    readonly totpUsedStep: (adminId: string, secretTag: string, step: number) => string;
};
/** Dedicated queue (not the shared `cleanup` queue, so no other processor can take these jobs). */
export declare const AUTH_QUEUE = "auth-maintenance";
export declare const AUTH_JOBS: {
    readonly PII_SCRUB: "pii-scrub";
};
