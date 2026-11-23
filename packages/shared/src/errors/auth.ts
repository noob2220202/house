// Owned by the auth module team. Codes are prefixed with the module name.
export const AuthErrorCode = {
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_SESSION_EXPIRED: 'AUTH_SESSION_EXPIRED',
  AUTH_OAUTH_STATE_INVALID: 'AUTH_OAUTH_STATE_INVALID',
  AUTH_OAUTH_PROVIDER_ERROR: 'AUTH_OAUTH_PROVIDER_ERROR',
  AUTH_TOTP_REQUIRED: 'AUTH_TOTP_REQUIRED',
  AUTH_TOTP_INVALID: 'AUTH_TOTP_INVALID',
  AUTH_ACCOUNT_LOCKED: 'AUTH_ACCOUNT_LOCKED',
  AUTH_ACCOUNT_SUSPENDED: 'AUTH_ACCOUNT_SUSPENDED',
  AUTH_IP_NOT_ALLOWED: 'AUTH_IP_NOT_ALLOWED',
  AUTH_TERMS_REQUIRED: 'AUTH_TERMS_REQUIRED',
} as const;

export const AUTH_ERROR_MESSAGES: Record<keyof typeof AuthErrorCode, string> = {
  AUTH_INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다.',
  AUTH_SESSION_EXPIRED: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
  AUTH_OAUTH_STATE_INVALID: '로그인 요청이 만료되었습니다. 다시 시도해 주세요.',
  AUTH_OAUTH_PROVIDER_ERROR: '소셜 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
  AUTH_TOTP_REQUIRED: '2단계 인증이 필요합니다.',
  AUTH_TOTP_INVALID: '인증 코드가 올바르지 않습니다.',
  AUTH_ACCOUNT_LOCKED: '로그인 시도가 너무 많아 계정이 잠겼습니다.',
  AUTH_ACCOUNT_SUSPENDED: '이용이 정지된 계정입니다.',
  AUTH_IP_NOT_ALLOWED: '허용되지 않은 접속 위치입니다.',
  AUTH_TERMS_REQUIRED: '필수 약관에 동의해 주세요.',
};
