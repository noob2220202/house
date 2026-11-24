import { type AdminDealRequestCloseInput, type Paginated } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { DealRequestMapper, type AdminDealRequestModerationView } from '../deal-request.mapper';
import type { AdminDealRequestListQueryWithSpam, AdminDealRequestSpamFlagInput } from '../dto';
import { NotificationsService } from '../notifications/notifications.service';
import { DealRequestLifecycleService } from './deal-request-lifecycle.service';
/**
 * Back-office moderation of 내놓기/구하기. Admins see the requester id and a masked contact only;
 * closing a request revokes every contact grant and notifies requester + proposing agencies.
 * Flagging a request as spam hides it from every agency (deal-request-access) until cleared; the
 * requester is not told and nothing else about the request changes.
 */
export declare class AdminDealRequestsService {
    private readonly prisma;
    private readonly mapper;
    private readonly notifications;
    private readonly lifecycle;
    constructor(prisma: PrismaService, mapper: DealRequestMapper, notifications: NotificationsService, lifecycle: DealRequestLifecycleService);
    list(q: AdminDealRequestListQueryWithSpam): Promise<Paginated<AdminDealRequestModerationView>>;
    get(id: string): Promise<AdminDealRequestModerationView>;
    close(id: string, input: AdminDealRequestCloseInput, now?: Date): Promise<AdminDealRequestModerationView>;
    /**
     * Sets or clears the spam flag. Re-flagging a flagged request only replaces the reason (and the
     * admin) and keeps the original flag time; clearing an unflagged one is a no-op.
     */
    setSpamFlag(id: string, input: AdminDealRequestSpamFlagInput, adminId: string, now?: Date): Promise<AdminDealRequestModerationView>;
    private load;
}
