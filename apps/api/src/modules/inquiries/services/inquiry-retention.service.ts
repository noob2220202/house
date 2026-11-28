import { INQUIRY_LIMITS } from '@house/shared';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { JOB_BATCH_SIZE } from '../constants';
import { retentionCutoff } from '../domain/customer';

/**
 * Data minimization (파기, 개인정보 보호법 제21조) of inquiries, run daily by InquiriesProcessor
 * (e2e calls it directly). Erases the customer's name and phone, the opening text, the office's
 * internal memo and free-text delete reason (both may quote the customer), the visitor hash and
 * every message body (and the customer's name on their messages), and stamps `pii_scrubbed_at`:
 *  - RETENTION_DAYS (365) after the last message (INQUIRY_PRIVACY terms: 마지막 답변 후 1년);
 *  - at once (next run) for inquiries of withdrawn members; AccountService.withdraw may call
 *    `scrubUser` inside the withdrawal transaction to do it immediately.
 * What stays is countable: office, listing, channel, status, source, dates, consent document ids.
 * Selection is by the marker under SKIP LOCKED, so the job is idempotent and safe to run twice.
 */
@Injectable()
export class InquiryRetentionService {
  private readonly logger = new Logger(InquiryRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async scrubDue(now: Date = new Date(), batchSize: number = JOB_BATCH_SIZE): Promise<number> {
    const cutoff = retentionCutoff(now, INQUIRY_LIMITS.RETENTION_DAYS);
    let total = 0;
    for (;;) {
      const count = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<{ id: string }[]>`
          SELECT i.id FROM inquiries i
          LEFT JOIN users u ON u.id = i.user_id
          WHERE i.pii_scrubbed_at IS NULL
            AND (i.last_message_at < ${cutoff} OR u.status = 'WITHDRAWN'::user_status)
          ORDER BY i.last_message_at
          LIMIT ${batchSize}
          FOR UPDATE OF i SKIP LOCKED`;
        return this.erase(
          tx,
          rows.map((r) => r.id),
          now,
        );
      });
      total += count;
      if (count < batchSize) break;
    }
    if (total > 0) this.logger.log({ count: total }, 'scrubbed inquiries');
    return total;
  }

  /** Every inquiry of one member (회원 탈퇴), inside the caller's transaction when given. */
  async scrubUser(userId: string, now: Date = new Date(), tx?: PrismaTx): Promise<number> {
    const run = async (db: PrismaTx): Promise<number> => {
      const rows = await db.inquiry.findMany({
        where: { userId, piiScrubbedAt: null },
        select: { id: true },
      });
      return this.erase(
        db,
        rows.map((r) => r.id),
        now,
      );
    };
    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  private async erase(tx: PrismaTx, ids: readonly string[], now: Date): Promise<number> {
    if (ids.length === 0) return 0;
    const { count } = await tx.inquiry.updateMany({
      where: { id: { in: [...ids] }, piiScrubbedAt: null },
      data: {
        customerName: null,
        customerPhone: null,
        message: null,
        memo: null,
        deleteReason: null,
        visitorHash: null,
        piiScrubbedAt: now,
      },
    });
    await tx.$executeRaw`
      UPDATE inquiry_messages
      SET body = '',
          author_name = CASE WHEN author = 'CUSTOMER'::inquiry_author THEN NULL ELSE author_name END
      WHERE inquiry_id = ANY(${[...ids]}::uuid[])`;
    return count;
  }
}
