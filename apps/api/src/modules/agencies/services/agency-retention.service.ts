import { AgencyStatus } from '@house/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { REJECTED_APPLICATION_RETENTION_YEARS, RETENTION_PURGE_BATCH_SIZE } from '../constants';
import { lockAgency, lockUserMembership } from '../domain/locks';
import {
  AGENCY_MEDIA,
  type AgencyMediaPort,
  type DiscardedMedia,
} from '../ports/agency-media.port';

/** Start of the retention period that has ended: `now` minus the period, in calendar years. */
export function rejectedRetentionCutoff(now: Date): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - REJECTED_APPLICATION_RETENTION_YEARS);
  return cutoff;
}

interface Candidate {
  id: string;
  owner_user_id: string;
}

/**
 * 개인정보 파기 of rejected 중개사무소 등록 신청 (PRIVACY_AGENCY_APPLICATION notice: "반려된 신청은
 * 반려 후 1년"). An application still REJECTED — i.e. not resubmitted — whose latest rejection is
 * older than REJECTED_APPLICATION_RETENTION_YEARS is erased: the agency row with its 대표자 성명,
 * 연락처, 이메일, 주소, 등록번호, 사업자등록번호 (hard delete; staff rows, documents and status history
 * cascade) and the uploaded documents (media rows soft-deleted, files removed right after commit,
 * the media cleanup purges the rows). Applications an admin deleted (soft delete, REJECTED) are
 * included. A rejected application never went live (REJECTED is reachable from PENDING only), so
 * nothing else references it; rows that somehow have listings are skipped and logged.
 * Every purge is audited (SYSTEM actor, no personal data in the entry).
 */
@Injectable()
export class AgencyRetentionService {
  private readonly logger = new Logger(AgencyRetentionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(AGENCY_MEDIA) private readonly media: AgencyMediaPort,
  ) {}

  /** Purges every due application (in batches); returns how many were purged. */
  async purgeRejectedApplications(now: Date = new Date()): Promise<number> {
    const cutoff = rejectedRetentionCutoff(now);
    let purged = 0;
    const skipped = new Set<string>();
    for (;;) {
      const batch = (await this.candidates(cutoff)).filter((c) => !skipped.has(c.id));
      if (batch.length === 0) break;
      for (const c of batch) {
        if (await this.purgeOne(c, cutoff, now)) purged += 1;
        else skipped.add(c.id);
      }
    }
    if (purged > 0) this.logger.log({ count: purged }, 'purged rejected agency applications');
    return purged;
  }

  private candidates(cutoff: Date): Promise<Candidate[]> {
    return this.prisma.$queryRaw<Candidate[]>`
      SELECT a.id::text AS id, a.owner_user_id::text AS owner_user_id
      FROM agencies a
      WHERE a.status = 'REJECTED'::agency_status
        AND a.approved_at IS NULL
        AND ${rejectedAtSql()} < ${cutoff}
      ORDER BY a.updated_at, a.id
      LIMIT ${RETENTION_PURGE_BATCH_SIZE}`;
  }

  /** One application in its own transaction, re-checked under the owner's and the agency's locks. */
  private async purgeOne(c: Candidate, cutoff: Date, now: Date): Promise<boolean> {
    const files = await this.prisma.$transaction(async (tx) => {
      // Same lock order as resubmit(): membership first, then the agency.
      await lockUserMembership(tx, c.owner_user_id);
      await lockAgency(tx, c.id);
      return this.erase(tx, c.id, cutoff, now);
    });
    if (!files) return false;
    await this.media.removeFiles(files).catch((err: unknown) => {
      // The media cleanup purge retries the file removal.
      this.logger.error({ err, agencyId: c.id }, 'failed to remove purged agency documents');
    });
    return true;
  }

  private async erase(
    tx: PrismaTx,
    agencyId: string,
    cutoff: Date,
    now: Date,
  ): Promise<DiscardedMedia[] | null> {
    const rows = await tx.$queryRaw<
      { rejected_at: Date; deleted_at: Date | null; listings: number }[]
    >`
      SELECT ${rejectedAtSql()} AS rejected_at, a.deleted_at,
        (SELECT count(*)::int FROM listings l WHERE l.primary_agency_id = a.id) AS listings
      FROM agencies a
      WHERE a.id = ${agencyId}::uuid
        AND a.status = 'REJECTED'::agency_status
        AND a.approved_at IS NULL`;
    const row = rows[0];
    // Resubmitted (PENDING again) or rejected again more recently in the meantime: not due.
    if (!row || row.rejected_at >= cutoff) return null;
    if (row.listings > 0) {
      this.logger.warn({ agencyId }, 'rejected agency still has listings; not purged');
      return null;
    }
    const agency = await tx.agency.findUniqueOrThrow({
      where: { id: agencyId },
      select: {
        logoMediaId: true,
        coverMediaId: true,
        documents: { select: { mediaId: true } },
      },
    });
    const documentIds = agency.documents.map((d) => d.mediaId);
    // Cascades: agency_members, agency_documents, agency_status_history, warnings, daily stats.
    await tx.agency.delete({ where: { id: agencyId } });
    const files = await this.media.discard(documentIds, tx, now);
    const images = [agency.logoMediaId, agency.coverMediaId].filter((id): id is string => !!id);
    if (images.length > 0) await this.media.released(images, tx);
    await this.audit.record(
      {
        action: 'agency.purge-rejected',
        resourceType: 'Agency',
        resourceId: agencyId,
        before: {
          status: AgencyStatus.REJECTED,
          rejectedAt: row.rejected_at,
          deleted: row.deleted_at !== null,
          documentCount: documentIds.length,
        },
        after: { purgedAt: now, documentsDiscarded: files.length },
      },
      tx,
    );
    return files;
  }
}

/**
 * When the application `a` was (last) rejected: its latest →REJECTED history row (decisions,
 * duplicate auto-rejections and admin deletions all write one), else its last update (rows created
 * without history, e.g. imports).
 */
function rejectedAtSql() {
  return Prisma.sql`COALESCE(
    (SELECT max(h.created_at) FROM agency_status_history h
      WHERE h.agency_id = a.id AND h.to_status = 'REJECTED'::agency_status),
    a.updated_at)`;
}
