import { UserRole, UserStatus } from '@house/shared';
import { z } from 'zod';

/**
 * Current user as returned by GET /api/v1/auth/me.
 * ASSUMED SHAPE (the auth module is not implemented yet) — see docs/frontend-integration/foundation.md.
 */
export const sessionUserSchema = z.object({
  id: z.string(),
  role: z.enum(UserRole),
  status: z.enum(UserStatus).default(UserStatus.ACTIVE),
  nickname: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  profileImageUrl: z.string().nullable().optional(),
  /** Agency the user belongs to (AGENT / AGENCY_OWNER). */
  agencyId: z.string().nullable().optional(),
  marketingOptIn: z.boolean().optional(),
  /** False until required terms are accepted → send the user to /signup. */
  signupCompleted: z.boolean().optional(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export function isAgent(user: SessionUser | null | undefined): boolean {
  return user?.role === UserRole.AGENT || user?.role === UserRole.AGENCY_OWNER;
}
