import { Injectable } from '@nestjs/common';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';

/**
 * Personal data the home module keeps per user (관심 중개사무소, 관심 지역). Exported for the
 * withdrawal PII scrub (auth PiiScrubService), which should call `purge` inside its transaction:
 * these tables have no FK to users, so nothing cascades.
 */
@Injectable()
export class HomeUserDataService {
  constructor(private readonly prisma: PrismaService) {}

  async purge(userIds: readonly string[], db: PrismaTx = this.prisma): Promise<void> {
    if (userIds.length === 0) return;
    const ids = [...userIds];
    await db.favoriteAgency.deleteMany({ where: { userId: { in: ids } } });
    await db.userInterestRegion.deleteMany({ where: { userId: { in: ids } } });
  }
}
