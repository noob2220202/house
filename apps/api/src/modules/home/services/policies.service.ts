import { ErrorCode, type Paginated } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { PolicyDocument, Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { HOME_CACHE, HOME_CACHE_TTL_SECONDS } from '../constants';
import {
  policySlugSchema,
  type PolicyAdminListQuery,
  type PolicyCreateInput,
  type PolicyUpdateInput,
} from '../dto';

/** GET /policies/:slug (web w-content `policyDocumentSchema`). */
export interface PolicyDocumentView {
  slug: string;
  title: string;
  version: string;
  effectiveAt: string;
  /** Plain text with light markup (the site renders it with <RichText>, never as HTML). */
  content: string;
}

/** Admin view of one policy version. */
export interface AdminPolicyView extends PolicyDocumentView {
  id: string;
  publishedAt: string | null;
  /** Published, effective and the latest of its slug: what the site shows now. */
  isCurrent: boolean;
  createdAt: string;
  updatedAt: string;
}

const PUBLISHED_IMMUTABLE_MESSAGE = '게시된 정책 문서는 고칠 수 없습니다. 새 버전을 만들어 주세요.';

const notFound = () => AppException.notFound(ErrorCode.POLICY_NOT_FOUND);

function toPublic(d: PolicyDocument): PolicyDocumentView {
  return {
    slug: d.slug,
    title: d.title,
    version: d.version,
    effectiveAt: d.effectiveAt.toISOString(),
    content: d.content,
  };
}

/**
 * Operating policy pages (허위매물 신고 정책 …), versioned like terms: the operator writes a draft,
 * publishes it (immutable from then on) and the site shows the latest published version whose
 * effectiveAt has passed; 404 until one exists ("준비 중" on the site).
 */
@Injectable()
export class PoliciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async current(slug: string, now: Date = new Date()): Promise<PolicyDocumentView> {
    if (!policySlugSchema.safeParse(slug).success) throw notFound();
    const version = await this.cache.version(HOME_CACHE.POLICIES);
    const doc = await this.cache.getOrSet<PolicyDocumentView | null>(
      `cache:home:policy:v${version}:${slug}`,
      HOME_CACHE_TTL_SECONDS.POLICY,
      async () => {
        const row = await this.currentRow(slug, now);
        return row ? toPublic(row) : null;
      },
    );
    if (!doc) throw notFound();
    return doc;
  }

  // ---- admin ----------------------------------------------------------------------------------

  async list(q: PolicyAdminListQuery): Promise<Paginated<AdminPolicyView>> {
    const where: Prisma.PolicyDocumentWhereInput = q.slug ? { slug: q.slug } : {};
    const page = await paginate(
      q,
      (args) =>
        this.prisma.policyDocument.findMany({
          where,
          orderBy: [{ slug: 'asc' }, { effectiveAt: 'desc' }, { createdAt: 'desc' }],
          ...args,
        }),
      () => this.prisma.policyDocument.count({ where }),
    );
    const currentIds = await this.currentIds([...new Set(page.items.map((d) => d.slug))]);
    return { ...page, items: page.items.map((d) => this.toAdmin(d, currentIds)) };
  }

  async detail(id: string): Promise<AdminPolicyView> {
    const row = await this.prisma.policyDocument.findUnique({ where: { id } });
    if (!row) throw notFound();
    return this.toAdmin(row, await this.currentIds([row.slug]));
  }

  async create(dto: PolicyCreateInput): Promise<AdminPolicyView> {
    const row = await this.prisma.policyDocument.create({
      data: { ...dto, effectiveAt: new Date(dto.effectiveAt) },
    });
    return this.detail(row.id);
  }

  async update(id: string, dto: PolicyUpdateInput): Promise<AdminPolicyView> {
    const before = await this.detail(id);
    if (before.publishedAt) {
      throw new AppException(ErrorCode.CONFLICT, { message: PUBLISHED_IMMUTABLE_MESSAGE });
    }
    RequestContext.setAuditBefore(before);
    const { count } = await this.prisma.policyDocument.updateMany({
      where: { id, publishedAt: null },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.effectiveAt !== undefined ? { effectiveAt: new Date(dto.effectiveAt) } : {}),
      },
    });
    if (count === 0) {
      throw new AppException(ErrorCode.CONFLICT, { message: PUBLISHED_IMMUTABLE_MESSAGE });
    }
    return this.detail(id);
  }

  async publish(id: string, now: Date = new Date()): Promise<AdminPolicyView> {
    const before = await this.detail(id);
    if (before.publishedAt) return before;
    RequestContext.setAuditBefore(before);
    await this.prisma.policyDocument.updateMany({
      where: { id, publishedAt: null },
      data: { publishedAt: now },
    });
    await this.cache.bump(HOME_CACHE.POLICIES);
    return this.detail(id);
  }

  /** Drafts only; published versions stay as the record of what was shown. */
  async remove(id: string): Promise<void> {
    const before = await this.detail(id);
    if (before.publishedAt) {
      throw new AppException(ErrorCode.CONFLICT, { message: PUBLISHED_IMMUTABLE_MESSAGE });
    }
    RequestContext.setAuditBefore(before);
    await this.prisma.policyDocument.deleteMany({ where: { id, publishedAt: null } });
  }

  private currentRow(slug: string, now: Date): Promise<PolicyDocument | null> {
    return this.prisma.policyDocument.findFirst({
      where: { slug, publishedAt: { not: null, lte: now }, effectiveAt: { lte: now } },
      orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }],
    });
  }

  private async currentIds(slugs: string[], now: Date = new Date()): Promise<Set<string>> {
    const rows = await Promise.all(slugs.map((s) => this.currentRow(s, now)));
    return new Set(rows.flatMap((r) => (r ? [r.id] : [])));
  }

  private toAdmin(d: PolicyDocument, currentIds: ReadonlySet<string>): AdminPolicyView {
    return {
      id: d.id,
      ...toPublic(d),
      publishedAt: d.publishedAt?.toISOString() ?? null,
      isCurrent: currentIds.has(d.id),
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    };
  }
}
