import { NotificationType } from '@house/shared';
import type { PrismaTx } from '../../../prisma/prisma.service';
export interface ListingNotice {
    type: typeof NotificationType.LISTING_EXPIRED | typeof NotificationType.CO_BROKER_REQUESTED;
    title: string;
    body: string;
    listingId: string;
}
/**
 * In-app notices to an agency's owner(s), written to the shared `notifications` table (read via
 * /me/notifications; no external delivery). A direct write: the notifications writer lives in the
 * deal-requests module, which depends on listings through agencies. Like every agency notice
 * (deal-requests NotificationsService.createForMembers) each row carries `data.agencyId` — the
 * office the recipient owns — so the console and the my-page can scope it (B5).
 */
export interface ListingNotifierPort {
    notifyAgencyOwners(db: PrismaTx, agencyIds: readonly string[], notice: ListingNotice): Promise<void>;
}
export declare const LISTING_NOTIFIER: unique symbol;
export declare class PrismaListingNotifier implements ListingNotifierPort {
    notifyAgencyOwners(db: PrismaTx, agencyIds: readonly string[], notice: ListingNotice): Promise<void>;
}
