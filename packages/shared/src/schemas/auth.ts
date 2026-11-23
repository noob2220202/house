// Owned by the auth module team.
import { z } from 'zod';
import {
  authProviderFromSlug,
  type AdminRole,
  type AuthProvider,
  TermsType,
  type UserRole,
  type UserStatus,
} from '../enums/user';
import { idSchema, phoneSchema } from './common';

/** `:provider` route param: lowercase slug (kakao | naver | google) → AuthProvider. */
export const oauthProviderParamSchema = z.object({
  provider: z.string().transform((slug, ctx) => {
    const provider = authProviderFromSlug(slug);
    if (!provider) {
      ctx.addIssue({ code: 'custom', message: '지원하지 않는 로그인 방식입니다.' });
      return z.NEVER;
    }
    return provider;
  }),
});
export type OAuthProviderParam = z.infer<typeof oauthProviderParamSchema>;

/**
 * Site-relative path ("/listings/1?x=y"). Rejects protocol-relative ("//evil"), backslashes
 * (browsers treat "/\\evil" like "//evil") and control characters, so it can be appended to
 * PUBLIC_BASE_URL safely.
 */
export const returnToSchema = z
  .string()
  .max(500)
  .regex(/^\/(?![/\\])[^\\\s]*$/, '잘못된 경로입니다.')
  .refine((v) => !/\p{Cc}/u.test(v), '잘못된 경로입니다.');

export const OAuthIntent = { LOGIN: 'login', LINK: 'link' } as const;
export type OAuthIntent = (typeof OAuthIntent)[keyof typeof OAuthIntent];

export const oauthStartQuerySchema = z.object({
  returnTo: returnToSchema.optional(),
  /** `link` attaches the provider account to the logged-in user instead of logging in. */
  intent: z.enum([OAuthIntent.LOGIN, OAuthIntent.LINK]).default(OAuthIntent.LOGIN),
});
export type OAuthStartQuery = z.infer<typeof oauthStartQuerySchema>;

/** All providers redirect back with GET ?code&state (or ?error). */
export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1).max(2000).optional(),
  state: z.string().min(1).max(200),
  error: z.string().max(200).optional(),
  error_description: z.string().max(1000).optional(),
});
export type OAuthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;

/** Agreement to one terms document version. */
export const consentItemSchema = z.object({ termsDocumentId: idSchema, agreed: z.boolean() });

export const nicknameSchema = z
  .string()
  .trim()
  .min(2, '닉네임은 2자 이상이어야 합니다.')
  .max(20, '닉네임은 20자 이하여야 합니다.')
  .regex(/^[0-9A-Za-z가-힣_.-]+$/, '닉네임에는 한글, 영문, 숫자, _ . - 만 사용할 수 있습니다.');

/**
 * Completes a social signup started by the OAuth callback (pending signup cookie). Required terms
 * must all be agreed; marketing is optional. `phone` is a plain contact field (never verified).
 * `ageOver14`: "만 14세 이상입니다" — 개인정보 보호법 제22조의2 requires guardian consent below 14,
 * which this service does not collect, so younger users cannot sign up. Stored as users.age_confirmed_at.
 */
export const signupSchema = z.object({
  nickname: nicknameSchema,
  ageOver14: z.literal(true, { error: '만 14세 이상만 가입할 수 있습니다.' }),
  phone: phoneSchema.nullable().optional(),
  consents: z.array(consentItemSchema).max(20),
  marketingOptIn: z.boolean().default(false),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const consentInputSchema = z.object({
  consents: z.array(consentItemSchema).min(1).max(20),
});
export type ConsentInput = z.infer<typeof consentInputSchema>;

export const termsTypeSchema = z.enum(TermsType);
export const termsTypeParamSchema = z.object({
  type: z
    .string()
    .transform((s) => s.toUpperCase())
    .pipe(termsTypeSchema),
});
export const termsVersionQuerySchema = z.object({
  version: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[0-9A-Za-z._-]+$/)
    .optional(),
});

/**
 * Profile edit. `phone` is a plain contact field (format-validated and normalized, never verified —
 * the platform sends no SMS). null clears it.
 */
export const updateProfileSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    phone: phoneSchema.nullable().optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), '변경할 항목이 없습니다.');
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const withdrawSchema = z.object({
  /** Explicit confirmation from the UI ("탈퇴하겠습니다" checkbox). */
  confirm: z.literal(true, { error: '탈퇴 확인이 필요합니다.' }),
  reason: z.string().trim().max(500).optional(),
});
export type WithdrawInput = z.infer<typeof withdrawSchema>;

/** Session ids are SHA-256 hex of the cookie token (never the token itself). */
export const sessionIdParamSchema = z.object({ id: z.string().regex(/^[0-9a-f]{64}$/) });

// ---------- admin auth ----------

export const adminLoginSchema = z.object({
  email: z
    .email()
    .max(254)
    .transform((e) => e.toLowerCase()),
  password: z.string().min(1).max(200),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const totpCodeSchema = z.string().regex(/^\d{6}$/, '6자리 숫자를 입력해 주세요.');
/** Recovery code shown once at enrollment: "ABCD-EFGH" (case/dash-insensitive). */
export const recoveryCodeSchema = z
  .string()
  .transform((s) => s.toUpperCase().replace(/[^0-9A-Z]/g, ''))
  .pipe(z.string().regex(/^[0-9A-Z]{8}$/, '복구 코드 형식이 올바르지 않습니다.'));

/** Second factor: a TOTP code, or one of the one-time recovery codes. Exactly one. */
export const adminTotpVerifySchema = z
  .object({ code: totpCodeSchema.optional(), recoveryCode: recoveryCodeSchema.optional() })
  .refine(
    (v) => (v.code === undefined) !== (v.recoveryCode === undefined),
    '인증 코드 또는 복구 코드 중 하나를 입력해 주세요.',
  );
export type AdminTotpVerifyInput = z.infer<typeof adminTotpVerifySchema>;

/**
 * POST /admin/auth/totp/setup. First enrollment: empty body. Rotation (TOTP already enabled):
 * the current password plus exactly one of a current TOTP code / a recovery code.
 */
export const adminTotpSetupSchema = z
  .object({
    currentPassword: z.string().min(1).max(200).optional(),
    code: totpCodeSchema.optional(),
    recoveryCode: recoveryCodeSchema.optional(),
  })
  .refine(
    (v) => v.code === undefined || v.recoveryCode === undefined,
    '인증 코드 또는 복구 코드 중 하나만 입력해 주세요.',
  )
  .default({});
export type AdminTotpSetupInput = z.infer<typeof adminTotpSetupSchema>;

/** Confirms a pending TOTP enrollment with the first code from the authenticator app. */
export const adminTotpActivateSchema = z.object({ code: totpCodeSchema });

/** Admin password policy: 12+ chars, letters + digits; max 128 (argon2 input bound). */
export const adminPasswordSchema = z
  .string()
  .min(12, '비밀번호는 12자 이상이어야 합니다.')
  .max(128)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), '영문과 숫자를 모두 포함해야 합니다.');

export const adminPasswordChangeSchema = z
  .object({ currentPassword: z.string().min(1).max(200), newPassword: adminPasswordSchema })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: '새 비밀번호가 기존 비밀번호와 같습니다.',
    path: ['newPassword'],
  });

// ---------- response shapes (consumed by the frontends) ----------

export interface CsrfTokenResponse {
  csrfToken: string;
}

export interface IdentitySummary {
  provider: AuthProvider;
  email: string | null;
  linkedAt: string;
  lastUsedAt: string | null;
}

export interface MeAgencyMembership {
  agencyId: string;
  agencyName: string;
  agencyStatus: string;
  memberRole: string;
}

export interface MeResponse {
  id: string;
  email: string | null;
  name: string | null;
  nickname: string | null;
  /** Digits only ("01012345678"); unverified contact field. */
  phone: string | null;
  profileImageUrl: string | null;
  role: UserRole;
  status: UserStatus;
  marketingOptIn: boolean;
  createdAt: string;
  identities: IdentitySummary[];
  /** Agency the session acts for (AGENT / AGENCY_OWNER). */
  agency: MeAgencyMembership | null;
  /** Required terms whose current version the user has not agreed to (re-consent prompt). */
  pendingRequiredTerms: TermsType[];
}

export interface SessionSummary {
  id: string;
  current: boolean;
  createdAt: string;
  lastSeenAt: string;
  ip: string | null;
  userAgent: string | null;
}

export interface TermsSummary {
  id: string;
  type: TermsType;
  version: string;
  title: string;
  isRequired: boolean;
  effectiveAt: string;
}

export interface TermsDetail extends TermsSummary {
  content: string;
}

export interface ConsentStatus {
  terms: TermsSummary;
  agreed: boolean;
  /** When the latest decision for this exact version was recorded. */
  decidedAt: string | null;
}

export interface SignupResponse {
  user: MeResponse;
  /** Where the user was heading before login (site-relative), if any. */
  returnTo: string | null;
  csrfToken: string;
}

export interface PendingSignupResponse {
  provider: AuthProvider;
  prefill: {
    nickname: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
    profileImageUrl: string | null;
  };
  terms: TermsSummary[];
}

export interface AdminLoginResponse {
  mfaRequired: true;
  /** false → the admin must enroll TOTP (setup + activate) before anything else. */
  totpEnrolled: boolean;
  /** CSRF token of the new (pre-TOTP) session, for the x-csrf-token header. */
  csrfToken: string;
}

/** Returned whenever the admin session is (re)issued as TOTP-verified. */
export interface AdminSessionResponse {
  admin: AdminMeResponse;
  /** The session was rotated: use this token from now on. */
  csrfToken: string;
}

export interface AdminTotpActivateResponse extends AdminSessionResponse {
  /** One-time recovery codes, shown exactly once. */
  recoveryCodes: string[];
}

export interface AdminTotpSetupResponse {
  /** Base32 secret, for manual entry. */
  secret: string;
  /** otpauth:// URI for the QR code. */
  otpauthUrl: string;
  expiresInSeconds: number;
}

export interface AdminMeResponse {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  totpEnabled: boolean;
  recoveryCodesRemaining: number;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
}
