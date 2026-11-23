import type { AdminRole, UserRole } from '@house/shared';

export type SessionKind = 'USER' | 'ADMIN';

/** Stored in Redis under session:<sha256(token)>. The raw token only ever lives in the cookie. */
export interface SessionRecord {
  id: string;
  kind: SessionKind;
  subjectId: string;
  role: UserRole | AdminRole;
  agencyId: string | null;
  mfaVerified: boolean;
  csrfToken: string;
  createdAt: number;
  lastSeenAt: number;
  absoluteExpiresAt: number;
  ip: string | null;
  userAgent: string | null;
}

export type CreateSessionInput =
  | {
      kind: 'USER';
      userId: string;
      role: UserRole;
      agencyId?: string | null;
      ip?: string;
      userAgent?: string;
    }
  | {
      kind: 'ADMIN';
      adminId: string;
      role: AdminRole;
      mfaVerified: boolean;
      ip?: string;
      userAgent?: string;
    };
