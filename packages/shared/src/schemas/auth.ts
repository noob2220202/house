// Owned by the auth module team.
import { z } from 'zod';
import { authProviderFromSlug, TermsType } from '../enums/user';
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

export const oauthStartQuerySchema = z.object({
  /** Site-relative path to return to after login. */
  returnTo: z
    .string()
    .max(500)
    .regex(/^\/(?!\/)/, '잘못된 경로입니다.')
    .optional(),
});

/** All providers redirect back with GET ?code&state (or ?error). */
export const oauthCallbackQuerySchema = z.object({
  code: z.string().min(1).max(2000).optional(),
  state: z.string().min(1).max(200),
  error: z.string().max(200).optional(),
  error_description: z.string().max(1000).optional(),
});
export type OAuthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;

export const adminLoginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});
export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminTotpVerifySchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export const consentInputSchema = z.object({
  consents: z
    .array(z.object({ termsDocumentId: idSchema, agreed: z.boolean() }))
    .min(1)
    .max(20),
});

export const termsTypeSchema = z.enum(TermsType);

/**
 * Profile edit. `phone` is a plain contact field (format-validated and normalized, never verified —
 * the platform sends no SMS). null clears it.
 */
export const updateProfileSchema = z.object({
  nickname: z.string().trim().min(1).max(30).optional(),
  phone: phoneSchema.nullable().optional(),
  marketingOptIn: z.boolean().optional(),
});

export const withdrawSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});
