import { type AdminListingDetail, type AdminListingListItem, type AdminListingListQuery, type AdminListingModerationInput, type Paginated } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../deal-requests/notifications/notifications.service';
import { type ListingModerationPort } from '../ports/listing-moderation.port';
/**
 * Back-office listing moderation (all agencies). Reads use the listing tables directly (read-only);
 * state changes go through the listings module (ListingModerationPort) so its counters and map
 * caches stay right. 동·호 (Property.ho) is never selected.
 */
export declare class AdminListingsService {
    private readonly prisma;
    private readonly moderation;
    private readonly notifications;
    constructor(prisma: PrismaService, moderation: ListingModerationPort, notifications: NotificationsService);
    list(q: AdminListingListQuery): Promise<Paginated<AdminListingListItem>>;
    detail(id: string): Promise<AdminListingDetail>;
    hide(id: string, dto: AdminListingModerationInput): Promise<AdminListingDetail>;
    unhide(id: string): Promise<AdminListingDetail>;
    forceClose(id: string, dto: AdminListingModerationInput): Promise<AdminListingDetail>;
    private notifyAgency;
    private load;
}
