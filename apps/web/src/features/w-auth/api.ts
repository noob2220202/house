import {
  AUTH_PROVIDER_SLUG,
  AuthProvider,
  type TermsType,
  type signupSchema,
  type withdrawSchema,
} from '@house/shared';
import { z } from 'zod';
import {
  termsDocumentSchema as termsVersionDocumentSchema,
  termsVersionSchema,
} from '@/features/w-content/api/schemas';
import { api, qk } from '@/lib/api';
import { sessionUserSchema } from '@/lib/auth/types';

/**
 * Typed calls of the w-auth page group, per the auth module of apps/api
 * (apps/api/src/modules/auth/README.md, response types in packages/shared/src/schemas/auth.ts).
 */

/** Small fixed lists arrive bare (the backend) or wrapped in `{ items }` (older mocks) — accept both. */
function listOf<T extends z.ZodType>(item: T) {
  return z
    .union([z.array(item), z.object({ items: z.array(item) })])
    .transform((v): z.output<T>[] => (Array.isArray(v) ? v : v.items));
}

// ---- terms ---------------------------------------------------------------------------------------

/**
 * A current (effective) document = shared `TermsSummary` (`@/features/w-content/api/schemas` holds
 * the version contract) with `isRequired`. `content` only on GET /terms/:type (plain text, rendered
 * with preserved line breaks, never as HTML).
 */
export const termsDocumentSchema = termsVersionSchema.extend({ isRequired: z.boolean() });
export type TermsDocument = z.infer<typeof termsDocumentSchema>;
export const termsListSchema = listOf(termsDocumentSchema);

/** GET /terms — the current (effective) account terms (SERVICE, PRIVACY, LOCATION, MARKETING). Public. */
export const fetchTerms = (signal?: AbortSignal) =>
  api.get('/terms', { schema: termsListSchema, signal });
/** GET /terms/:type — current document with content. Public. */
export const fetchTermsDocument = (type: TermsType, signal?: AbortSignal) =>
  api.get(`/terms/${type}`, { schema: termsDocumentSchema, signal });

/**
 * GET /terms/:type?version= — one past or current version with content (the version a member agreed
 * to, for the consent history). Public.
 */
export const fetchTermsVersion = (type: TermsType, version: string, signal?: AbortSignal) =>
  api.get(`/terms/${type}`, { query: { version }, schema: termsVersionDocumentSchema, signal });

// ---- social signup (pending signup cookie, no session yet) ---------------------------------------

/** GET /auth/signup — `PendingSignupResponse`: provider profile prefill + the current account terms. */
export const pendingSignupSchema = z.object({
  provider: z.enum(AuthProvider),
  prefill: z
    .object({
      nickname: z.string().nullable().optional(),
      name: z.string().nullable().optional(),
      email: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      profileImageUrl: z.string().nullable().optional(),
    })
    .default({}),
  terms: z.array(termsDocumentSchema),
});
export type PendingSignup = z.infer<typeof pendingSignupSchema>;

/**
 * Must be called from the browser: the pending signup cookie (`house_signup`) is scoped to the
 * /api/v1/auth/signup path, so a server render of /signup never carries it.
 * 401 `AUTH_SIGNUP_EXPIRED` when there is no live pending signup (30 minutes after the callback).
 */
export const fetchPendingSignup = (signal?: AbortSignal) =>
  api.get('/auth/signup', { schema: pendingSignupSchema, signal });

/** POST /auth/signup → `SignupResponse`: the new session's user, the stored `returnTo` and CSRF token. */
export const signupResponseSchema = z.object({
  user: sessionUserSchema,
  returnTo: z.string().nullable().optional(),
  csrfToken: z.string(),
});
export type SignupResult = z.infer<typeof signupResponseSchema>;
export type SignupBody = z.input<typeof signupSchema>;
export const completeSignup = (body: SignupBody) =>
  api.post('/auth/signup', body, { schema: signupResponseSchema });

// ---- consents ------------------------------------------------------------------------------------

/** One row of GET/POST /me/consents (`ConsentStatus`), flattened for the UI. */
export const consentRecordSchema = z
  .object({
    terms: termsDocumentSchema,
    agreed: z.boolean(),
    /** When the latest decision for this exact version was recorded (null = never decided). */
    decidedAt: z.string().nullable().optional(),
  })
  .transform(({ terms, agreed, decidedAt }) => ({
    termsDocumentId: terms.id,
    type: terms.type,
    version: terms.version,
    title: terms.title,
    isRequired: terms.isRequired,
    effectiveAt: terms.effectiveAt,
    agreed,
    decidedAt: decidedAt ?? null,
  }));
export type ConsentRecord = z.output<typeof consentRecordSchema>;
export const consentListSchema = listOf(consentRecordSchema);

/** GET /me/consents — the member's latest decision for every current account document. */
export const fetchConsents = (signal?: AbortSignal) =>
  api.get('/me/consents', { schema: consentListSchema, signal });
/**
 * POST /me/consents — body = `consentInputSchema` (@house/shared). Used for re-consent to a new
 * required version and for the marketing opt-in. Answers the updated list.
 */
export const submitConsents = (body: {
  consents: { termsDocumentId: string; agreed: boolean }[];
}) => api.post('/me/consents', body, { schema: consentListSchema });

// ---- interest regions (frontend contract, implemented by the backend to this shape) --------------

export const interestRegionsSchema = z.object({
  regionKeys: z.array(z.string()),
  /** 선택한 지역에 새 매물이 오르면 알림 받기. */
  notify: z.boolean(),
});
export type InterestRegions = z.infer<typeof interestRegionsSchema>;
export const saveInterestRegions = (body: InterestRegions) =>
  api.put('/me/interest-regions', body, { schema: interestRegionsSchema });

// ---- linked social accounts ----------------------------------------------------------------------

/**
 * `IdentitySummary` of GET /me/identities: `{ provider, email, linkedAt, lastUsedAt }`.
 * `createdAt` (the older mock name of `linkedAt`) is still read so cached rows keep one shape.
 */
export const identitySchema = z
  .object({
    provider: z.enum(AuthProvider),
    /** Provider account e-mail (may be hidden by the user at the provider). */
    email: z.string().nullable().optional(),
    linkedAt: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    lastUsedAt: z.string().nullable().optional(),
  })
  .transform(({ provider, email, linkedAt, createdAt, lastUsedAt }) => ({
    provider,
    email: email ?? null,
    /** When the account was linked. */
    linkedAt: linkedAt ?? createdAt ?? null,
    lastUsedAt: lastUsedAt ?? null,
  }));
export type Identity = z.output<typeof identitySchema>;
export const identityListSchema = listOf(identitySchema);

export const fetchIdentities = (signal?: AbortSignal) =>
  api.get('/me/identities', { schema: identityListSchema, signal });
/**
 * DELETE /me/identities/{kakao|naver|google} → the remaining identities.
 * 409 `AUTH_LAST_IDENTITY` for the only login method.
 */
export const unlinkIdentity = (provider: AuthProvider) =>
  api.delete(`/me/identities/${AUTH_PROVIDER_SLUG[provider]}`, { schema: identityListSchema });

// ---- session / withdrawal ------------------------------------------------------------------------

/** POST /auth/logout-all — destroys every session of the user (all devices, this one included). */
export const logoutAll = () => api.post('/auth/logout-all');

export type WithdrawInput = z.input<typeof withdrawSchema>;
/**
 * POST /me/withdraw `{ confirm: true, reason? }` — soft delete, all sessions destroyed, PII scrub
 * scheduled. 409 `AUTH_WITHDRAW_AGENCY_OWNER` while the member owns an agency.
 */
export const withdrawAccount = (body: WithdrawInput) => api.post('/me/withdraw', body);
/**
 * POST /auth/withdraw `{ confirm: true, reason? }` — withdrawal of a suspended member, who has no
 * session: authenticated by the single-use `house_withdraw` ticket the refused login set
 * (10 minutes). 401 once the ticket is gone.
 */
export const withdrawSuspendedAccount = (body: WithdrawInput) => api.post('/auth/withdraw', body);

// ---- query keys ----------------------------------------------------------------------------------

export const authKeys = {
  terms: () => qk('terms', 'current'),
  termsDocument: (type: TermsType) => qk('terms', 'document', type),
  termsVersion: (type: TermsType, version: string) => qk('terms', 'version', { type, version }),
  pendingSignup: () => qk('auth', 'signup'),
  consents: () => qk('me', 'consents'),
  /** Same key as the w-me profile prefetch so both pages share one cache entry. */
  identities: () => ['me-identities'] as const,
};
