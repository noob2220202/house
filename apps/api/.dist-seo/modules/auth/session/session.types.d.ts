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
    /** Overrides the kind's default idle TTL (e.g. short pre-TOTP admin sessions). */
    idleTtlSeconds?: number;
    /** Admin sessions: per-account IP allowlist (IPs/CIDRs) re-checked on every request. */
    ipAllowlist?: string[];
    ip: string | null;
    userAgent: string | null;
}
interface CommonSessionInput {
    ip?: string;
    userAgent?: string;
    idleTtlSeconds?: number;
}
export type CreateSessionInput = (CommonSessionInput & {
    kind: 'USER';
    userId: string;
    role: UserRole;
    agencyId?: string | null;
}) | (CommonSessionInput & {
    kind: 'ADMIN';
    adminId: string;
    role: AdminRole;
    mfaVerified: boolean;
    ipAllowlist?: string[];
});
export type SessionPatch = Partial<Pick<SessionRecord, 'mfaVerified' | 'agencyId' | 'role'>>;
export {};
