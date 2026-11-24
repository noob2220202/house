import {
  AUTH_PROVIDER_SLUG,
  AuthProvider,
  TermsType,
  type updateProfileSchema,
  type withdrawSchema,
} from '@house/shared';
import { z } from 'zod';
import {
  termsDocumentSchema as termsVersionDocumentSchema,
  termsVersionSchema,
} from '@/features/w-content/api/schemas';
import { api, qk } from '@/lib/api';

/**
 * Typed calls of the w-auth page group. Paths mirror apps/api/src/modules/auth/README.md; payload
 * shapes are ASSUMED until the controllers land (docs/frontend-integration/w-auth.md).
 */

/** Small fixed lists may arrive bare or wrapped in `{ items }` — accept both. */
function listOf<T extends z.ZodType>(item: T) {
  return z
    .union([z.array(item), z.object({ items: z.array(item) })])
    .transform((v): z.output<T>[] => (Array.isArray(v) ? v : v.items));
}

// ---- terms ---------------------------------------------------------------------------------------

/**
 * A current (effective) document — the shared terms contract (`@/features/w-content/api/schemas`)
 * with `isRequired`, which the backend always sends for the effective version. `content` only on
 * GET /terms/:type (plain text, rendered with preserved line breaks).
 */
export const termsDocumentSchema = termsVersionSchema.extend({ isRequired: z.boolean() });
export type TermsDocument = z.infer<typeof termsDocumentSchema>;
export const termsListSchema = listOf(termsDocumentSchema);

/** GET /terms — the current (effective) document of every type. Public. */
export const fetchTerms = (signal?: AbortSignal) =>
  api.get('/terms', { schema: termsListSchema, signal });
/** GET /terms/:type — current document with content. Public. */
export const fetchTermsDocument = (type: TermsType, signal?: AbortSignal) =>
  api.get(`/terms/${type}`, { schema: termsDocumentSchema, signal });

/**
 * GET /terms/:type/versions/:version — one specific version with content (the version a user agreed
 * to). Public. ASSUMED endpoint shared with the w-content group (docs/frontend-integration/w-content.md).
 */
export const fetchTermsVersion = (type: TermsType, version: string, signal?: AbortSignal) =>
  api.get(`/terms/${type}/versions/${encodeURIComponent(version)}`, {
    schema: termsVersionDocumentSchema,
    signal,
  });

// ---- consents ------------------------------------------------------------------------------------

export const consentRecordSchema = z.object({
  termsDocumentId: z.string(),
  type: z.enum(TermsType),
  version: z.string(),
  title: z.string(),
  isRequired: z.boolean().optional(),
  agreed: z.boolean(),
  /** When the latest agree/revoke record was created. */
  createdAt: z.string(),
});
export type ConsentRecord = z.infer<typeof consentRecordSchema>;
export const consentListSchema = listOf(consentRecordSchema);

/** GET /me/consents — latest record per terms type. */
export const fetchConsents = (signal?: AbortSignal) =>
  api.get('/me/consents', { schema: consentListSchema, signal });
/** POST /me/consents — body = consentInputSchema (@house/shared). */
export const submitConsents = (body: {
  consents: { termsDocumentId: string; agreed: boolean }[];
}) => api.post('/me/consents', body);

// ---- profile -------------------------------------------------------------------------------------

export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
/** PATCH /me/profile (nickname, phone, marketingOptIn) → the updated session user. */
export const updateProfile = (body: UpdateProfileInput) => api.patch('/me/profile', body);

// ---- interest regions (ASSUMED endpoint) ---------------------------------------------------------

export const interestRegionsSchema = z.object({
  regionKeys: z.array(z.string()),
  /** 선택한 지역에 새 매물이 오르면 알림 받기. */
  notify: z.boolean(),
});
export type InterestRegions = z.infer<typeof interestRegionsSchema>;
export const saveInterestRegions = (body: InterestRegions) =>
  api.put('/me/interest-regions', body, { schema: interestRegionsSchema });

// ---- linked social accounts (ASSUMED endpoints) --------------------------------------------------

/** Identity model columns the UI needs (same shape as the w-me group's schema). */
export const identitySchema = z.object({
  id: z.string().optional(),
  provider: z.enum(AuthProvider),
  /** Provider account e-mail (may be hidden by the user at the provider). */
  email: z.string().nullable().optional(),
  lastUsedAt: z.string().nullable().optional(),
  /** When the account was linked. */
  createdAt: z.string().nullable().optional(),
});
export type Identity = z.infer<typeof identitySchema>;
export const identityListSchema = listOf(identitySchema);

export const fetchIdentities = (signal?: AbortSignal) =>
  api.get('/me/identities', { schema: identityListSchema, signal });
/** DELETE /me/identities/{kakao|naver|google} — a user holds at most one identity per provider. */
export const unlinkIdentity = (provider: AuthProvider) =>
  api.delete(`/me/identities/${AUTH_PROVIDER_SLUG[provider]}`);

// ---- session / withdrawal ------------------------------------------------------------------------

/** POST /auth/logout-all — destroys every session of the user (all devices). */
export const logoutAll = () => api.post('/auth/logout-all');

export type WithdrawInput = z.input<typeof withdrawSchema>;
/** POST /me/withdraw — soft delete, all sessions destroyed, PII scrub scheduled. */
export const withdrawAccount = (body: WithdrawInput) => api.post('/me/withdraw', body);

// ---- query keys ----------------------------------------------------------------------------------

export const authKeys = {
  terms: () => qk('terms', 'current'),
  termsDocument: (type: TermsType) => qk('terms', 'document', type),
  termsVersion: (type: TermsType, version: string) => qk('terms', 'version', { type, version }),
  consents: () => qk('me', 'consents'),
  /** Same key as the w-me group's `useIdentities` so both views share one cache entry. */
  identities: () => ['me-identities'] as const,
};
