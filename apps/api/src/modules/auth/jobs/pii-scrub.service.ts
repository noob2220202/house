import { Injectable, Logger } from '@nestjs/common';
import { UserStatus } from '@house/shared';
import { PrismaService } from '../../../prisma/prisma.service';

const BATCH_SIZE = 200;

/**
 * Scrubs personal data of withdrawn members once their grace period (piiScrubAfter) has passed.
 * Idempotent: only rows not yet scrubbed are touched, so re-running (or a retry) is harmless.
 * The User row itself stays (FKs from listings, reports, audit) as an anonymous tombstone.
 */
@Injectable()
export class PiiScrubService {
  private readonly logger = new Logger(PiiScrubService.name);

  constructor(private readonly prisma: PrismaService) {}

  async scrubDue(now: Date = new Date()): Promise<number> {
    let total = 0;
    for (;;) {
      const batch = await this.prisma.user.findMany({
        where: { status: UserStatus.WITHDRAWN, piiScrubbedAt: null, piiScrubAfter: { lte: now } },
        select: { id: true },
        orderBy: { piiScrubAfter: 'asc' },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      const ids = batch.map((u) => u.id);
      await this.prisma.$transaction([
        this.prisma.identity.deleteMany({ where: { userId: { in: ids } } }),
        this.prisma.userConsent.updateMany({
          where: { userId: { in: ids } },
          data: { ip: null, userAgent: null },
        }),
        this.prisma.user.updateMany({
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
        }),
      ]);
      total += ids.length;
      if (batch.length < BATCH_SIZE) break;
    }
    if (total > 0) this.logger.log({ count: total }, 'scrubbed PII of withdrawn members');
    return total;
  }
}
