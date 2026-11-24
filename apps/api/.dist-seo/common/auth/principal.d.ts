import type { AdminRole, UserRole } from '@house/shared';
export interface UserPrincipal {
    kind: 'USER';
    userId: string;
    role: UserRole;
    /** Agency the user acts for (AGENT / AGENCY_OWNER); null for plain users. */
    agencyId: string | null;
    sessionId: string;
}
export interface AdminPrincipal {
    kind: 'ADMIN';
    adminId: string;
    role: AdminRole;
    sessionId: string;
    /** TOTP verified for this session. Admin routes require it. */
    mfaVerified: boolean;
}
export type Principal = UserPrincipal | AdminPrincipal;
export declare function isUserPrincipal(p: Principal | undefined): p is UserPrincipal;
export declare function isAdminPrincipal(p: Principal | undefined): p is AdminPrincipal;
