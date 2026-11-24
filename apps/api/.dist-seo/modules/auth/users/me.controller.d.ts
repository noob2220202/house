import type { ConsentStatus, IdentitySummary, MeResponse } from '@house/shared';
import type { Response } from 'express';
import type { UserPrincipal } from '../../../common/auth/principal';
import { ConsentInputDto, OAuthProviderParamDto, UpdateProfileDto, WithdrawDto } from '../dto';
import { AccountService } from './account.service';
/**
 * The member's own account. Linking a provider starts at GET /auth/oauth/:provider/start?intent=link.
 * Exempt from TermsConsentGuard: agreeing to new terms happens here, and a member who does not
 * agree must still be able to correct or delete their data and withdraw.
 */
export declare class MeController {
    private readonly accounts;
    constructor(accounts: AccountService);
    updateProfile(user: UserPrincipal, dto: UpdateProfileDto): Promise<MeResponse>;
    identities(user: UserPrincipal): Promise<IdentitySummary[]>;
    unlink(user: UserPrincipal, params: OAuthProviderParamDto): Promise<IdentitySummary[]>;
    consents(user: UserPrincipal): Promise<ConsentStatus[]>;
    updateConsents(user: UserPrincipal, dto: ConsentInputDto): Promise<ConsentStatus[]>;
    withdraw(user: UserPrincipal, dto: WithdrawDto, res: Response): Promise<void>;
}
