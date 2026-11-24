/**
 * Korean copy for every failure of a social login or account link. The backend's OAuth callback
 * redirects a failed login to `/login?error=<AuthErrorCode>` (a suspended member also gets
 * `&withdrawable=1`) and a failed link to `/me/account?error=<AuthErrorCode>`. Raw OAuth2 `error`
 * values and a few client-side situations (no session after the round trip) are covered too.
 */
export interface OAuthErrorInfo {
  /**
   * Code shown small for support: a known code, or an unknown one only when it looks like an error
   * code (letters and single underscores) — free text and digits are never echoed back, so a crafted
   * link cannot print a phone number or a message on our page.
   */
  code: string;
  title: string;
  description: string;
  /** Offer "다시 로그인" (or "계정 설정으로" when linking). False when retrying cannot help. */
  canRetry: boolean;
  /** Offer a link to the support page. */
  support: boolean;
  /** `notice` = user-initiated / harmless (cancel), `error` = something failed. */
  tone: 'notice' | 'error';
  /** The failed round trip was linking a provider to a signed-in account, not a login. */
  linking: boolean;
  /**
   * A suspended member may still withdraw (POST /auth/withdraw with the ticket the refused login
   * set): offer the withdrawal flow.
   */
  withdrawable: boolean;
}

type Entry = Omit<OAuthErrorInfo, 'code' | 'linking' | 'withdrawable'>;

const CANCELLED: Entry = {
  title: '로그인을 취소했어요',
  description: '동의 화면에서 취소를 누르셨어요. 다시 시도하려면 아래 버튼을 눌러 주세요.',
  canRetry: true,
  support: false,
  tone: 'notice',
};
const EXPIRED: Entry = {
  title: '로그인 요청이 만료됐어요',
  description:
    '로그인 창을 오래 열어 두었거나 뒤로 가기로 다시 들어온 경우예요. 처음부터 다시 시도해 주세요.',
  canRetry: true,
  support: false,
  tone: 'error',
};
const PROVIDER_FAILED: Entry = {
  title: '소셜 로그인에 실패했어요',
  description:
    '로그인 서비스에서 응답을 받지 못했어요. 잠시 후 다시 시도하거나 다른 계정으로 로그인해 주세요.',
  canRetry: true,
  support: true,
  tone: 'error',
};
const NO_SESSION: Entry = {
  title: '로그인이 완료되지 않았어요',
  description:
    '브라우저가 쿠키를 차단하고 있으면 로그인 상태를 유지할 수 없어요. 쿠키 설정을 확인한 뒤 다시 시도해 주세요.',
  canRetry: true,
  support: true,
  tone: 'error',
};

const TABLE: Record<string, Entry> = {
  // --- provider (OAuth2 / OIDC) error values
  ACCESS_DENIED: CANCELLED,
  USER_CANCELLED: CANCELLED,
  CONSENT_REQUIRED: CANCELLED,
  INTERACTION_REQUIRED: CANCELLED,
  LOGIN_REQUIRED: CANCELLED,
  SERVER_ERROR: PROVIDER_FAILED,
  TEMPORARILY_UNAVAILABLE: PROVIDER_FAILED,
  INVALID_REQUEST: PROVIDER_FAILED,
  INVALID_SCOPE: PROVIDER_FAILED,
  UNAUTHORIZED_CLIENT: PROVIDER_FAILED,
  // --- backend codes (packages/shared/src/errors/auth.ts)
  AUTH_OAUTH_CANCELLED: CANCELLED,
  AUTH_OAUTH_STATE_INVALID: EXPIRED,
  AUTH_OAUTH_PROVIDER_ERROR: PROVIDER_FAILED,
  AUTH_SESSION_EXPIRED: NO_SESSION,
  UNAUTHENTICATED: NO_SESSION,
  NO_SESSION,
  AUTH_PROVIDER_DISABLED: {
    title: '지금은 쓸 수 없는 로그인 방식이에요',
    description: '이 간편 로그인은 잠시 사용할 수 없어요. 다른 계정으로 로그인해 주세요.',
    canRetry: true,
    support: true,
    tone: 'error',
  },
  AUTH_ACCOUNT_SUSPENDED: {
    title: '이용이 정지된 계정이에요',
    description:
      '운영 정책 위반 등의 사유로 이용이 제한된 계정이에요. 자세한 내용은 고객센터로 문의해 주세요.',
    canRetry: false,
    support: true,
    tone: 'error',
  },
  AUTH_ACCOUNT_LOCKED: {
    title: '잠시 후 다시 시도해 주세요',
    description: '로그인 시도가 너무 많아 잠시 제한됐어요. 몇 분 뒤 다시 시도해 주세요.',
    canRetry: true,
    support: false,
    tone: 'error',
  },
  AUTH_ACCOUNT_WITHDRAWN: {
    title: '탈퇴 처리된 계정이에요',
    description:
      '탈퇴한 계정으로는 로그인할 수 없어요. 개인정보 파기가 끝난 뒤 같은 계정으로 다시 가입할 수 있어요.',
    canRetry: false,
    support: true,
    tone: 'error',
  },
  AUTH_REJOIN_COOLDOWN: {
    title: '지금은 다시 가입할 수 없어요',
    description:
      '탈퇴한 소셜 계정은 탈퇴 후 일정 기간 동안 다시 가입할 수 없어요. 기간이 지난 뒤 다시 시도하거나 다른 계정으로 가입해 주세요.',
    canRetry: false,
    support: true,
    tone: 'notice',
  },
  AUTH_SIGNUP_EXPIRED: {
    title: '가입 시간이 지났어요',
    description: '가입 화면을 오래 열어 두었어요. 간편 로그인을 다시 하면 이어서 가입할 수 있어요.',
    canRetry: true,
    support: false,
    tone: 'notice',
  },
  AUTH_TERMS_REQUIRED: {
    title: '약관 동의가 필요해요',
    description: '바뀐 필수 약관에 동의해야 서비스를 계속 이용할 수 있어요.',
    canRetry: true,
    support: false,
    tone: 'notice',
  },
  AUTH_IDENTITY_DUPLICATE: {
    title: '이미 다른 회원에 연결된 계정이에요',
    description:
      '이 소셜 계정은 다른 회원 정보에 연결돼 있어요. 해당 계정으로 로그인하거나, 그 회원 정보에서 연결을 해제한 뒤 다시 시도해 주세요.',
    canRetry: true,
    support: true,
    tone: 'error',
  },
  AUTH_PROVIDER_ALREADY_LINKED: {
    title: '이미 연결된 서비스예요',
    description:
      '같은 서비스의 다른 계정이 이미 연결돼 있어요. 바꾸려면 지금 연결된 계정을 먼저 해제해 주세요.',
    canRetry: true,
    support: false,
    tone: 'notice',
  },
  AUTH_LAST_IDENTITY: {
    title: '마지막 로그인 수단이에요',
    description: '다른 계정을 먼저 연결해야 이 계정의 연결을 해제할 수 있어요.',
    canRetry: true,
    support: false,
    tone: 'notice',
  },
  RATE_LIMITED: {
    title: '요청이 너무 많아요',
    description: '짧은 시간에 여러 번 시도했어요. 잠시 후 다시 시도해 주세요.',
    canRetry: true,
    support: false,
    tone: 'error',
  },
};

const FALLBACK: Entry = {
  title: '로그인하지 못했어요',
  description:
    '일시적인 문제일 수 있어요. 다시 시도해도 같은 화면이 보이면 고객센터로 알려 주세요.',
  canRetry: true,
  support: true,
  tone: 'error',
};

/** Codes are compared case-insensitively; anything unexpected is clamped to a short safe token. */
export function normalizeOAuthErrorCode(raw: string | null | undefined): string {
  const code = (raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .slice(0, 48);
  return code || 'UNKNOWN';
}

/** Shape of an OAuth2 / backend error code: letters in underscore-separated words. */
const CODE_SHAPE = /^[A-Z]+(?:_[A-Z]+)*$/;
const MAX_SHOWN_CODE = 40;

/** Copy of a failed *link* round trip (계정 설정 → 연결하기): it is not a login, so no "다시 로그인". */
const LINK_CANCELLED: Entry = {
  title: '계정 연결을 취소했어요',
  description: '연결 화면에서 취소를 누르셨어요. 계정 설정에서 언제든 다시 연결할 수 있어요.',
  canRetry: true,
  support: false,
  tone: 'notice',
};
const LINK_FAILED: Entry = {
  title: '계정을 연결하지 못했어요',
  description:
    '일시적인 문제일 수 있어요. 계정 설정에서 다시 시도하고, 같은 화면이 보이면 고객센터로 알려 주세요.',
  canRetry: true,
  support: true,
  tone: 'error',
};
/** Errors that read the same for a login and a link (they are about the account, not the flow). */
const ACCOUNT_CODES = new Set([
  'AUTH_ACCOUNT_SUSPENDED',
  'AUTH_ACCOUNT_LOCKED',
  'AUTH_ACCOUNT_WITHDRAWN',
  'AUTH_IDENTITY_DUPLICATE',
  'AUTH_PROVIDER_ALREADY_LINKED',
  'RATE_LIMITED',
]);
/** Codes the backend only sends back from a link round trip. */
const LINK_ONLY_CODES = new Set(['AUTH_IDENTITY_DUPLICATE', 'AUTH_PROVIDER_ALREADY_LINKED']);

const SUSPENDED_WITHDRAWABLE: Entry = {
  title: '이용이 정지된 계정이에요',
  description:
    '운영 정책 위반 등의 사유로 이용이 제한된 계정이에요. 이용 정지 중에도 회원 탈퇴는 할 수 있고, 자세한 내용은 고객센터로 문의할 수 있어요.',
  canRetry: false,
  support: true,
  tone: 'error',
};

export interface OAuthErrorContext {
  /** The failure came back to 계정 설정 (`/me/account?error=`): the round trip was a link. */
  linking?: boolean;
  /** `withdrawable=1` next to `AUTH_ACCOUNT_SUSPENDED`: the backend issued a withdrawal ticket. */
  withdrawable?: boolean;
}

export function oauthErrorInfo(
  raw: string | null | undefined,
  { linking: linkParam = false, withdrawable: withdrawParam = false }: OAuthErrorContext = {},
): OAuthErrorInfo {
  const normalized = normalizeOAuthErrorCode(raw);
  const known = TABLE[normalized];
  const code =
    known || (CODE_SHAPE.test(normalized) && normalized.length <= MAX_SHOWN_CODE)
      ? normalized
      : 'UNKNOWN';
  // An identity that belongs to someone else can only come out of a link attempt.
  const linking = linkParam || LINK_ONLY_CODES.has(normalized);
  const withdrawable = withdrawParam && normalized === 'AUTH_ACCOUNT_SUSPENDED' && !linking;
  if (withdrawable) return { code, ...SUSPENDED_WITHDRAWABLE, linking, withdrawable };
  if (!linking) return { code, ...(known ?? FALLBACK), linking, withdrawable };
  const entry =
    ACCOUNT_CODES.has(normalized) && known
      ? known
      : known === CANCELLED
        ? LINK_CANCELLED
        : LINK_FAILED;
  return { code, ...entry, linking, withdrawable };
}
