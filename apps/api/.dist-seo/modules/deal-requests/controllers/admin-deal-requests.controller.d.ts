import type { Paginated } from '@house/shared';
import type { AdminPrincipal } from '../../../common/auth/principal';
import type { AdminDealRequestModerationView } from '../deal-request.mapper';
import { AdminDealRequestCloseDto, AdminDealRequestListQueryDto, AdminDealRequestSpamFlagDto, IdParamDto } from '../dto';
import { AdminDealRequestsService } from '../services/admin-deal-requests.service';
/** Back-office moderation of 내놓기/구하기 (/api/v1/admin/deal-requests). */
export declare class AdminDealRequestsController {
    private readonly admin;
    constructor(admin: AdminDealRequestsService);
    list(q: AdminDealRequestListQueryDto): Promise<Paginated<AdminDealRequestModerationView>>;
    get(p: IdParamDto): Promise<AdminDealRequestModerationView>;
    close(p: IdParamDto, dto: AdminDealRequestCloseDto): Promise<AdminDealRequestModerationView>;
    /**
     * Spam flag `{ flagged, reason? }` (reason ≥ 5 chars when flagging). A flagged request is hidden
     * from every agency until the flag is cleared.
     */
    spamFlag(p: IdParamDto, dto: AdminDealRequestSpamFlagDto, admin: AdminPrincipal): Promise<AdminDealRequestModerationView>;
}
