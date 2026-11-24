import type { AdminAccountView, Paginated } from '@house/shared';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AdminAccountCreateDto, AdminAccountListQueryDto, AdminAccountUpdateDto, AdminPasswordResetDto, IdParamDto } from '../dto';
import { AdminAccountsService } from '../services/admin-accounts.service';
/**
 * Back-office accounts (SUPER_ADMIN only). DELETE is a soft delete (the row stays DISABLED with a
 * released e-mail so audit history keeps its actor).
 */
export declare class AdminAccountsController {
    private readonly accounts;
    constructor(accounts: AdminAccountsService);
    list(q: AdminAccountListQueryDto): Promise<Paginated<AdminAccountView>>;
    detail(p: IdParamDto): Promise<AdminAccountView>;
    create(dto: AdminAccountCreateDto): Promise<AdminAccountView>;
    update(p: IdParamDto, dto: AdminAccountUpdateDto, actor: AdminPrincipal): Promise<AdminAccountView>;
    resetPassword(p: IdParamDto, dto: AdminPasswordResetDto, actor: AdminPrincipal): Promise<AdminAccountView>;
    resetTotp(p: IdParamDto, actor: AdminPrincipal): Promise<AdminAccountView>;
    remove(p: IdParamDto, actor: AdminPrincipal): Promise<void>;
    unlock(p: IdParamDto): Promise<AdminAccountView>;
}
