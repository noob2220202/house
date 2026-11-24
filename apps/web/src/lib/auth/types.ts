import { AuthProvider, TermsType, UserRole, UserStatus } from '@house/shared';
import { z } from 'zod';

/** Shown wherever a member has no nickname (the PII scrub or an admin cleared it). */
export const FALLBACK_NICKNAME = '회원';

const agencyMembershipSchema = z.object({
  agencyId: z.string(),
  agencyName: z.string(),
  agencyStatus: z.string(),
  memberRole: z.string(),
});

const identitySummarySchema = z.object({
  provider: z.enum(AuthProvider),
  email: z.string().nullable().optional(),
  linkedAt: z.string().nullable().optional(),
  lastUsedAt: z.string().nullable().optional(),
});

/**
 * Current user = `MeResponse` of GET /api/v1/auth/me (packages/shared/src/schemas/auth.ts).
 * Parsed leniently and normalized for the UI:
 *  - `nickname` is nullable in the backend; the UI always gets a display string (`hasNickname`
 *    says whether the member set one), so a scrubbed profile never breaks a page;
 *  - `agencyId` mirrors `agency?.agencyId` (the agency the session acts for);
 *  - `signupCompleted` is always true: the backend creates a session only after
 *    POST /auth/signup, so a session user has finished signing up. Required terms that changed
 *    since are `pendingRequiredTerms` (re-consent prompt, POST /me/consents), not a signup.
 */
export const sessionUserSchema = z
  .object({
    id: z.string(),
    role: z.enum(UserRole),
    status: z.enum(UserStatus).default(UserStatus.ACTIVE),
    nickname: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    profileImageUrl: z.string().nullable().optional(),
    marketingOptIn: z.boolean().default(false),
    /** Start of the current marketing opt-in (정보통신망법 제50조 수신동의 일자); null while opted out. */
    marketingOptInAt: z.string().nullable().optional(),
    createdAt: z.string().nullable().optional(),
    identities: z.array(identitySummarySchema).default([]),
    /** Agency the session acts for (AGENT / AGENCY_OWNER). */
    agency: agencyMembershipSchema.nullable().default(null),
    /** Required account terms whose current version the member has not agreed to yet. */
    pendingRequiredTerms: z.array(z.enum(TermsType)).default([]),
  })
  .transform(({ nickname, ...user }) => {
    const trimmed = nickname?.trim() ?? '';
    return {
      ...user,
      nickname: trimmed || FALLBACK_NICKNAME,
      hasNickname: trimmed.length > 0,
      agencyId: user.agency?.agencyId ?? null,
      signupCompleted: true as boolean,
    };
  });
export type SessionUser = z.output<typeof sessionUserSchema>;

export function isAgent(user: Pick<SessionUser, 'role'> | null | undefined): boolean {
  return user?.role === UserRole.AGENT || user?.role === UserRole.AGENCY_OWNER;
}

/** The member still has to agree to a new version of a required document. */
export function needsReconsent(user: Pick<SessionUser, 'pendingRequiredTerms'> | null | undefined) {
  return (user?.pendingRequiredTerms.length ?? 0) > 0;
}
