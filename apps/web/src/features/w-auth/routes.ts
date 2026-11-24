/**
 * Routes owned by the w-auth page group that are not part of `ROUTES` in src/config/nav.ts.
 * (`/login` and `/signup` are `ROUTES.login` / `ROUTES.signup`.)
 */
export const AUTH_ROUTES = {
  /** OAuth landing: the backend returns here (`returnTo`) after the provider round trip, or with `?error=`. */
  callback: '/auth/callback',
  /** Farewell page shown after account withdrawal (public). */
  withdrawn: '/auth/withdrawn',
  /** 계정 설정: linked social accounts, consent history, logout. */
  account: '/me/account',
  /** 회원 탈퇴 flow. */
  withdraw: '/me/withdraw',
} as const;
