import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { ListingsModerationService } from '../../listings/services/listings-moderation.service';
import { MediaService } from '../../media/media.service';
import { WithdrawnIdentityService } from '../users/withdrawn-identity.service';

const BATCH_SIZE = 200;
/** displayName is NOT NULL on agency_members; what a scrubbed former staff member shows as. */
const WITHDRAWN_MEMBER_NAME = '탈퇴 회원';

/**
 * Scrubs personal data of withdrawn members once their grace period (piiScrubAfter) has passed:
 * profile fields, identities, consent ip/UA, phone + ip on their reports, their notifications,
 * recent views and favorites, and the name / title / phone / license number on their former
 * agency staff rows (and any listing contact still pointing at those); uploaded file names are
 * forgotten and unattached uploads deleted (MediaService.scrubOwner). Also drops expired rejoin-cooldown tombstones.
 * Idempotent: only rows not yet scrubbed are touched, so re-running (or a retry) is harmless.
 * The User row itself stays (FKs from listings, reports, audit) as an anonymous tombstone.
 * Deal requests are erased at withdrawal time (AccountService.withdraw → DealRequestMaintenance).
 */
@Injectable()
export class PiiScrubService {
  private readonly logger = new Logger(PiiScrubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly withdrawn: WithdrawnIdentityService,
    private readonly media: MediaService,
    private readonly listings: ListingsModerationService,
  ) {}

  async scrubDue(now: Date = new Date()): Promise<number> {
    let total = 0;
    let listingContactsCleared = 0;
    for (;;) {
      const batch = await this.prisma.user.findMany({
        where: { status: UserStatus.WITHDRAWN, piiScrubbedAt: null, piiScrubAfter: { lte: now } },
        select: { id: true },
        orderBy: { piiScrubAfter: 'asc' },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      const ids = batch.map((u) => u.id);
      await this.prisma.$transaction(
        async (tx) => {
          await tx.identity.deleteMany({ where: { userId: { in: ids } } });
          await tx.userConsent.updateMany({
            where: { userId: { in: ids } },
            data: { ip: null, userAgent: null },
          });
          await tx.report.updateMany({
            where: { reporterUserId: { in: ids } },
            data: { reporterPhone: null, ip: null },
          });
          await tx.notification.deleteMany({ where: { userId: { in: ids } } });
          await tx.recentView.deleteMany({ where: { userId: { in: ids } } });
          await tx.favoriteListing.deleteMany({ where: { userId: { in: ids } } });
          await tx.favoriteComplex.deleteMany({ where: { userId: { in: ids } } });
          for (const id of ids) await this.media.scrubOwner(id, tx, now);
          // Former agency staff rows (kept REMOVED for the office's history) lose who they were.
          const members = await tx.agencyMember.findMany({
            where: { userId: { in: ids } },
            select: { id: true },
          });
          if (members.length > 0) {
            const memberIds = members.map((m) => m.id);
            await tx.agencyMember.updateMany({
              where: { id: { in: memberIds } },
              data: {
                displayName: WITHDRAWN_MEMBER_NAME,
                title: null,
                phone: null,
                licenseNumber: null,
              },
            });
            // Guard: withdrawal already moved these contacts to the office's 대표 (memberDeparted).
            const { count } = await tx.listingAgency.updateMany({
              where: { contactMemberId: { in: memberIds } },
              data: { contactMemberId: null, contactName: null, contactPhone: null },
            });
            listingContactsCleared += count;
          }
          await tx.user.updateMany({
            where: { id: { in: ids }, piiScrubbedAt: null },
            data: {
              email: null,
              name: null,
              nickname: null,
              phone: null,
              profileImageUrl: null,
              withdrawalReason: null,
              suspendedReason: null,
              piiScrubbedAt: now,
            },
          });
        },
        { timeout: 60_000 },
      );
      total += ids.length;
      if (batch.length < BATCH_SIZE) break;
    }
    if (listingContactsCleared > 0) await this.listings.invalidateSearch();
    if (total > 0) this.logger.log({ count: total }, 'scrubbed PII of withdrawn members');
    const purged = await this.withdrawn.purgeExpired(now);
    if (purged > 0) this.logger.log({ count: purged }, 'purged expired rejoin-cooldown tombstones');
    return total;
  }
}
