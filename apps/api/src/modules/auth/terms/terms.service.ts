import { Injectable } from '@nestjs/common';
import {
  type ConsentStatus,
  ErrorCode,
  type TermsDetail,
  type TermsSummary,
  TermsType,
} from '@house/shared';
import type { TermsDocument } from '@prisma/client';
import { AppException } from '../../../common/errors/app.exception';
import { RequestContext } from '../../../common/context/request-context';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';

export interface ConsentDecision {
  termsDocumentId: string;
  agreed: boolean;
}

/** Display order of terms types (이용약관 → 개인정보 → 위치기반 → 마케팅). */
const TYPE_ORDER: TermsType[] = [
  TermsType.SERVICE,
  TermsType.PRIVACY,
  TermsType.LOCATION,
  TermsType.MARKETING,
];

export function toTermsSummary(d: TermsDocument): TermsSummary {
  return {
    id: d.id,
    type: d.type,
    version: d.version,
    title: d.title,
    isRequired: d.isRequired,
    effectiveAt: d.effectiveAt.toISOString(),
  };
}

/**
 * Terms documents (read side; authoring lives in the admin module) and append-only consent records.
 * "Current" = published, effective now, latest effectiveAt per type.
 */
@Injectable()
export class TermsService {
  constructor(private readonly prisma: PrismaService) {}

  async current(now: Date = new Date(), db: PrismaTx = this.prisma): Promise<TermsDocument[]> {
    const docs = await db.termsDocument.findMany({
      where: { publishedAt: { not: null, lte: now }, effectiveAt: { lte: now } },
      orderBy: [{ type: 'asc' }, { effectiveAt: 'desc' }, { createdAt: 'desc' }],
      distinct: ['type'],
    });
    return docs.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  }

  async listCurrent(): Promise<TermsSummary[]> {
    return (await this.current()).map(toTermsSummary);
  }

  /** Current version of a type, or a specific published version (history view). */
  async getByType(type: TermsType, version?: string): Promise<TermsDetail> {
    const now = new Date();
    const doc = version
      ? await this.prisma.termsDocument.findFirst({
          where: { type, version, publishedAt: { not: null, lte: now } },
        })
      : await this.prisma.termsDocument.findFirst({
          where: { type, publishedAt: { not: null, lte: now }, effectiveAt: { lte: now } },
          orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
        });
    if (!doc) throw AppException.notFound(ErrorCode.AUTH_TERMS_NOT_FOUND);
    return { ...toTermsSummary(doc), content: doc.content };
  }

  /**
   * Checks consent decisions against the current documents.
   *  - every referenced document must be a current one (stale tab → AUTH_TERMS_INVALID)
   *  - a required document can't be declined (AUTH_REQUIRED_TERMS_REVOKE)
   *  - with `requireAll`, every current required document must be agreed (AUTH_TERMS_REQUIRED)
   */
  validate(
    current: TermsDocument[],
    decisions: ConsentDecision[],
    opts: { requireAll: boolean },
  ): Map<string, TermsDocument> {
    const byId = new Map(current.map((d) => [d.id, d]));
    const seen = new Set<string>();
    for (const c of decisions) {
      const doc = byId.get(c.termsDocumentId);
      if (!doc || seen.has(c.termsDocumentId)) {
        throw AppException.badRequest(ErrorCode.AUTH_TERMS_INVALID, {
          termsDocumentId: c.termsDocumentId,
        });
      }
      seen.add(c.termsDocumentId);
      if (doc.isRequired && !c.agreed) {
        throw AppException.badRequest(ErrorCode.AUTH_REQUIRED_TERMS_REVOKE, { type: doc.type });
      }
    }
    if (opts.requireAll) {
      const agreed = new Set(decisions.filter((c) => c.agreed).map((c) => c.termsDocumentId));
      const missing = current.filter((d) => d.isRequired && !agreed.has(d.id)).map((d) => d.type);
      if (missing.length > 0) {
        throw AppException.badRequest(ErrorCode.AUTH_TERMS_REQUIRED, { missing });
      }
    }
    return byId;
  }

  async record(tx: PrismaTx, userId: string, decisions: ConsentDecision[]): Promise<void> {
    if (decisions.length === 0) return;
    const ctx = RequestContext.current();
    await tx.userConsent.createMany({
      data: decisions.map((c) => ({
        userId,
        termsDocumentId: c.termsDocumentId,
        agreed: c.agreed,
        ip: ctx?.ip?.slice(0, 64) ?? null,
        userAgent: ctx?.userAgent?.slice(0, 500) ?? null,
      })),
    });
  }

  /** Latest decision per document for the given ids. */
  async latestDecisions(
    userId: string,
    termsDocumentIds: string[],
    db: PrismaTx = this.prisma,
  ): Promise<Map<string, { agreed: boolean; createdAt: Date }>> {
    if (termsDocumentIds.length === 0) return new Map();
    const rows = await db.userConsent.findMany({
      where: { userId, termsDocumentId: { in: termsDocumentIds } },
      orderBy: [{ termsDocumentId: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
      distinct: ['termsDocumentId'],
      select: { termsDocumentId: true, agreed: true, createdAt: true },
    });
    return new Map(rows.map((r) => [r.termsDocumentId, r]));
  }

  async status(userId: string): Promise<ConsentStatus[]> {
    const current = await this.current();
    const latest = await this.latestDecisions(
      userId,
      current.map((d) => d.id),
    );
    return current.map((d) => {
      const decision = latest.get(d.id);
      return {
        terms: toTermsSummary(d),
        agreed: decision?.agreed ?? false,
        decidedAt: decision?.createdAt.toISOString() ?? null,
      };
    });
  }

  /**
   * Required types whose current version the user has not (or no longer) agreed to.
   * `required` (the current required documents) may be passed when the caller already has it.
   */
  async pendingRequired(userId: string, required?: TermsDocument[]): Promise<TermsType[]> {
    required ??= (await this.current()).filter((d) => d.isRequired);
    const latest = await this.latestDecisions(
      userId,
      required.map((d) => d.id),
    );
    return required.filter((d) => latest.get(d.id)?.agreed !== true).map((d) => d.type);
  }
}
