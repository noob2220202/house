import { AgencyMemberRole, AgencyMemberStatus, NotificationType } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { PrismaTx } from '../../../prisma/prisma.service';

export interface ListingNotice {
  title: string;
  body: string;
  listingId: string;
}

/**
 * In-app notices to an agency's owner(s). Bound to a Prisma implementation writing the shared
 * `notifications` table until a notifications module exports a writer (no external delivery).
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
      select: { userId: true },
    });
    const userIds = [...new Set(owners.map((o) => o.userId))];
    if (userIds.length === 0) return;
    await db.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: NotificationType.SYSTEM,
        title: notice.title,
        body: notice.body,
        data: { listingId: notice.listingId },
      })),
    });
  }
}
