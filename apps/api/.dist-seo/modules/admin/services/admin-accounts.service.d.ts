import { type AdminAccountCreateInput, type AdminAccountListQuery, type AdminAccountUpdateInput, type AdminAccountView, type AdminPasswordResetInput, type Paginated } from '@house/shared';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
import { PasswordService, SessionService } from '../../auth';
/** Tombstoned e-mail of a soft-deleted account (frees the address for a new account). */
export declare const deletedAdminEmail: (id: string) => string;
/**
 * Back-office account management (SUPER_ADMIN only). Accounts are never hard-deleted: DELETE is a
 * soft delete (DISABLED, e-mail released, credentials cleared, `admin_account_deletions` row) so
 * audit history keeps its actor; deleted accounts are hidden from every route here (404).
 * Any change to role / status / IP allowlist and every credential reset ends the account's
 * sessions.
 */
export declare class AdminAccountsService {
    private readonly prisma;
    private readonly passwords;
    private readonly sessions;
    constructor(prisma: PrismaService, passwords: PasswordService, sessions: SessionService);
    list(q: AdminAccountListQuery): Promise<Paginated<AdminAccountView>>;
    detail(id: string): Promise<AdminAccountView>;
    create(dto: AdminAccountCreateInput): Promise<AdminAccountView>;
    update(actor: AdminPrincipal, id: string, dto: AdminAccountUpdateInput): Promise<AdminAccountView>;
    resetPassword(actor: AdminPrincipal, id: string, dto: AdminPasswordResetInput): Promise<AdminAccountView>;
    /** Clears TOTP + recovery codes; the admin enrolls again at the next login. */
    resetTotp(actor: AdminPrincipal, id: string): Promise<AdminAccountView>;
    unlock(id: string): Promise<AdminAccountView>;
    /**
     * Soft delete (SUPER_ADMIN): not oneself, not the last active SUPER_ADMIN. The row stays for the
     * audit trail but is DISABLED, its e-mail tombstoned, password / TOTP / recovery codes cleared,
     * and all its sessions end.
     */
    remove(actor: AdminPrincipal, id: string): Promise<void>;
    private deletedIds;
    private assertNotSelf;
    private assertKeepsSuperAdmin;
    private load;
}
