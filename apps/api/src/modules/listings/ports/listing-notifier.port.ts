import { AgencyMemberRole, AgencyMemberStatus, NotificationType } from '@house/shared';
import { Injectable } from '@nestjs/common';
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
  notifyAgencyOwners(
    db: PrismaTx,
    agencyIds: readonly string[],
    notice: ListingNotice,
  ): Promise<void>;
}

export const LISTING_NOTIFIER = Symbol('LISTING_NOTIFIER');

@Injectable()
export class PrismaListingNotifier implements ListingNotifierPort {
  async notifyAgencyOwners(
    db: PrismaTx,
    agencyIds: readonly string[],
    notice: ListingNotice,
  ): Promise<void> {
    const ids = [...new Set(agencyIds)];
    if (ids.length === 0) return;
    const owners = await db.agencyMember.findMany({
      where: {
        agencyId: { in: ids },
        role: AgencyMemberRole.OWNER,
        status: AgencyMemberStatus.ACTIVE,
      },
      select: { userId: true, agencyId: true },
      orderBy: { createdAt: 'asc' },
    });
    // One row per user (first agency wins), as createForMembers does.
    const agencyOf = new Map<string, string>();
    for (const o of owners) if (!agencyOf.has(o.userId)) agencyOf.set(o.userId, o.agencyId);
    if (agencyOf.size === 0) return;
    await db.notification.createMany({
      data: [...agencyOf].map(([userId, agencyId]) => ({
        userId,
        type: notice.type,
        title: notice.title,
        body: notice.body,
        data: { listingId: notice.listingId, agencyId },
      })),
    });
  }
}
