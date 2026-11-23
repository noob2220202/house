import { ListingStatus, PUBLIC_LISTING_STATUSES } from '@house/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { EXPIRE_LISTING_ADS_BATCH } from '../constants';
import { LISTING_NOTIFIER, type ListingNotifierPort } from '../ports/listing-notifier.port';
import { ListingCountersService } from './listing-counters.service';

const PUBLIC_STATUSES = Prisma.join(
  PUBLIC_LISTING_STATUSES.map((s) => Prisma.sql`${s}::listing_status`),
);

interface ExpiredRow {
  id: string;
  complexId: string | null;
  primaryAgencyId: string;
}

/**
 * 광고기간 만료: ACTIVE/RESERVED listings whose expiresAt has passed go back to DRAFT, so the
 * agency must re-check the property and publish again (which re-runs the 명시사항 check). Batched,
 * SKIP LOCKED and idempotent: a second run over the same state changes nothing.
 */
@Injectable()
export class ListingExpiryService {
  private readonly logger = new Logger(ListingExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly counters: ListingCountersService,
    @Inject(LISTING_NOTIFIER) private readonly notifier: ListingNotifierPort,
  ) {}

  async expireDue(
    now: Date = new Date(),
    batch: number = EXPIRE_LISTING_ADS_BATCH,
  ): Promise<number> {
    let total = 0;
    for (;;) {
      const expired = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<ExpiredRow[]>`
          UPDATE listings l
          SET status = ${ListingStatus.DRAFT}::listing_status, version = l.version + 1,
              updated_at = now()
          WHERE l.id IN (
            SELECT id FROM listings
            WHERE status IN (${PUBLIC_STATUSES}) AND deleted_at IS NULL AND expires_at <= ${now}
            ORDER BY expires_at
            LIMIT ${batch}
            FOR UPDATE SKIP LOCKED)
          RETURNING l.id, l.complex_id AS "complexId", l.primary_agency_id AS "primaryAgencyId"`;
        if (rows.length === 0) return rows;
        const ids = rows.map((r) => r.id);
        const links = await tx.listingAgency.findMany({
          where: { listingId: { in: ids } },
          select: { agencyId: true },
        });
        await this.counters.refresh(tx, {
          complexIds: rows.map((r) => r.complexId),
          agencyIds: links.map((l) => l.agencyId),
        });
        for (const r of rows) {
          await this.notifier.notifyAgencyOwners(tx, [r.primaryAgencyId], {
            title: '매물 광고기간이 만료되었습니다.',
            body: '거래 가능 여부를 다시 확인한 뒤 매물을 다시 게시해 주세요.',
            listingId: r.id,
          });
        }
        return rows;
      });
      total += expired.length;
      if (expired.length < batch) break;
    }
    if (total > 0) {
      await this.counters.invalidateSearch();
      this.logger.log({ expired: total }, 'expired listing ads');
    }
    return total;
  }
}
