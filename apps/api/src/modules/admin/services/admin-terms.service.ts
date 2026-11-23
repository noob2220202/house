import {
  type AdminTermsView,
  canTermsTypeBeRequired,
  ErrorCode,
  type Paginated,
  type TermsAdminListQuery,
  type TermsDocumentInput,
  type TermsDocumentUpdateInput,
  TERMS_NOTICE_DAYS,
  type TermsPublishInput,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { Prisma, type TermsDocument } from '@prisma/client';
import { AuditService } from '../../../common/audit/audit.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { TermsService } from '../../auth';

interface TermsContext {
  /** id of the current (published + effective, latest) document per type */
  currentIds: Set<string>;
  /** id of the newest published document per type (current or scheduled) */
  latestPublishedIds: Set<string>;
  consentCounts: Map<string, number>;
}

/**
 * Terms authoring. Documents are immutable once published: a change is a new version. Publishing a
 * required version makes every user who agreed only to older versions show up in
 * `/auth/me.pendingRequiredTerms` from its effectiveAt on (the auth module computes that from the
 * current documents, so there is no flag to flip per user).
 */
@Injectable()
export class AdminTermsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly terms: TermsService,
    private readonly audit: AuditService,
  ) {}

  async list(q: TermsAdminListQuery): Promise<Paginated<AdminTermsView>> {
    const where: Prisma.TermsDocumentWhereInput = {
      ...(q.type ? { type: q.type } : {}),
      ...(q.published === true ? { publishedAt: { not: null } } : {}),
      ...(q.published === false ? { publishedAt: null } : {}),
    };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.termsDocument.findMany({
          where,
          orderBy: [{ type: 'asc' }, { effectiveAt: 'desc' }, { createdAt: 'desc' }],
          ...args,
        }),
      () => this.prisma.termsDocument.count({ where }),
    );
    const ctx = await this.context(page.items.map((d) => d.id));
    return { ...page, items: page.items.map((d) => this.view(d, ctx)) };
  }

  async detail(id: string): Promise<AdminTermsView> {
    const doc = await this.load(id);
    return this.view(doc, await this.context([doc.id]));
  }

  async create(dto: TermsDocumentInput): Promise<AdminTermsView> {
    this.assertRequirable(dto.type, dto.isRequired);
    try {
      const doc = await this.prisma.termsDocument.create({
        data: { ...dto, effectiveAt: new Date(dto.effectiveAt) },
      });
      return this.detail(doc.id);
    } catch (err) {
      throw this.mapDuplicate(err);
    }
  }

  async update(id: string, dto: TermsDocumentUpdateInput): Promise<AdminTermsView> {
    const before = await this.loadDraft(id);
    this.assertRequirable(before.type, dto.isRequired ?? before.isRequired);
    RequestContext.setAuditBefore(await this.detail(before.id));
    try {
      await this.prisma.termsDocument.update({
        where: { id },
        data: {
          ...dto,
          ...(dto.effectiveAt ? { effectiveAt: new Date(dto.effectiveAt) } : {}),
        },
      });
    } catch (err) {
      throw this.mapDuplicate(err);
    }
    return this.detail(id);
  }

  /**
   * Publishes a draft. effectiveAt must be
   *  - not in the past (a version never becomes current retroactively),
   *  - later than every published version of the same type (versions stay ordered, "current" is
   *    unambiguous), and
   *  - for a revision of an already published type, at least TERMS_NOTICE_DAYS away so users get
   *    advance notice (scheduled versions are readable before they take effect) — unless
   *    `urgent` with a reason, which the audit row records.
   */
  async publish(
    id: string,
    dto: TermsPublishInput,
    now: Date = new Date(),
  ): Promise<AdminTermsView> {
    const before = await this.detail((await this.loadDraft(id)).id);
    await this.prisma.$transaction(async (tx) => {
      const draft = await this.loadDraft(id, tx);
      // Drafts saved before this rule existed must not become a mandatory marketing/location consent.
      this.assertRequirable(draft.type, draft.isRequired);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`terms:${draft.type}`}))`;
      const latest = await tx.termsDocument.findFirst({
        where: { type: draft.type, publishedAt: { not: null } },
        orderBy: { effectiveAt: 'desc' },
        select: { id: true, version: true, effectiveAt: true },
      });
      const effectiveAt = draft.effectiveAt.getTime();
      if (effectiveAt < now.getTime()) {
        throw AppException.badRequest(ErrorCode.TERMS_EFFECTIVE_AT_INVALID, { reason: 'PAST' });
      }
      if (latest && effectiveAt <= latest.effectiveAt.getTime()) {
        throw AppException.badRequest(ErrorCode.TERMS_EFFECTIVE_AT_INVALID, {
          reason: 'NOT_AFTER_LATEST',
          latestVersion: latest.version,
          latestEffectiveAt: latest.effectiveAt.toISOString(),
        });
      }
      const earliest = now.getTime() + TERMS_NOTICE_DAYS * 86_400_000;
      if (latest && !dto.urgent && effectiveAt < earliest) {
        throw AppException.badRequest(ErrorCode.TERMS_EFFECTIVE_AT_INVALID, {
          reason: 'NOTICE_PERIOD',
          noticeDays: TERMS_NOTICE_DAYS,
          earliestEffectiveAt: new Date(earliest).toISOString(),
        });
      }
      const { count } = await tx.termsDocument.updateMany({
        where: { id, publishedAt: null },
        data: { publishedAt: now },
      });
      if (count === 0) throw AppException.conflict(ErrorCode.TERMS_ALREADY_PUBLISHED);
      const { content: _content, ...snapshot } = before;
      await this.audit.record(
        {
          action: 'terms.publish',
          resourceType: 'TermsDocument',
          resourceId: id,
          before: snapshot,
          after: {
            ...snapshot,
            publishedAt: now.toISOString(),
            noticeDays: Math.floor((effectiveAt - now.getTime()) / 86_400_000),
            urgent: dto.urgent,
            urgentReason: dto.urgent ? (dto.reason ?? null) : null,
          },
        },
        tx,
      );
    });
    return this.detail(id);
  }

  async remove(id: string): Promise<void> {
    const draft = await this.loadDraft(id);
    RequestContext.setAuditBefore(await this.detail(draft.id));
    const { count } = await this.prisma.termsDocument.deleteMany({
      where: { id, publishedAt: null },
    });
    if (count === 0) throw AppException.conflict(ErrorCode.TERMS_ALREADY_PUBLISHED);
  }

  private view(d: TermsDocument, ctx: TermsContext): AdminTermsView {
    return {
      id: d.id,
      type: d.type,
      version: d.version,
      title: d.title,
      content: d.content,
      isRequired: d.isRequired,
      effectiveAt: d.effectiveAt.toISOString(),
      publishedAt: d.publishedAt?.toISOString() ?? null,
      isCurrent: ctx.currentIds.has(d.id),
      requiresReconsent: d.isRequired && ctx.latestPublishedIds.has(d.id),
      consentCount: ctx.consentCounts.get(d.id) ?? 0,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }

  private async context(ids: string[]): Promise<TermsContext> {
    const [current, latest, counts] = await Promise.all([
      this.terms.current(),
      this.prisma.termsDocument.findMany({
        where: { publishedAt: { not: null } },
        orderBy: [{ type: 'asc' }, { effectiveAt: 'desc' }],
        distinct: ['type'],
        select: { id: true, type: true },
      }),
      ids.length === 0
        ? Promise.resolve([])
        : this.prisma.userConsent.groupBy({
            by: ['termsDocumentId'],
            where: { termsDocumentId: { in: ids }, agreed: true },
            _count: { _all: true },
          }),
    ]);
    return {
      currentIds: new Set(current.map((d) => d.id)),
      latestPublishedIds: new Set(latest.map((d) => d.id)),
      consentCounts: new Map(counts.map((c) => [c.termsDocumentId, c._count._all])),
    };
  }

  private mapDuplicate(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return AppException.conflict(ErrorCode.TERMS_VERSION_DUPLICATE);
    }
    return err;
  }

  /** MARKETING / LOCATION consent is optional by law/design (see OPTIONAL_ONLY_TERMS_TYPES). */
  private assertRequirable(type: TermsDocument['type'], isRequired: boolean): void {
    if (isRequired && !canTermsTypeBeRequired(type)) {
      throw AppException.badRequest(ErrorCode.TERMS_OPTIONAL_ONLY, { type });
    }
  }

  private async load(id: string, db: PrismaTx = this.prisma): Promise<TermsDocument> {
    const doc = await db.termsDocument.findUnique({ where: { id } });
    if (!doc) throw AppException.notFound(ErrorCode.TERMS_NOT_FOUND);
    return doc;
  }

  private async loadDraft(id: string, db: PrismaTx = this.prisma): Promise<TermsDocument> {
    const doc = await this.load(id, db);
    if (doc.publishedAt) throw AppException.conflict(ErrorCode.TERMS_ALREADY_PUBLISHED);
    return doc;
  }
}
