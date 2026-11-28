import {
  AgencyStatus,
  AgencySiteStatus,
  DEFAULT_AGENCY_SITE_COLOR,
  ErrorCode,
  normalizeSiteSlug,
  type AgencyProfile,
  type AgencySiteRequestInput,
  type AgencySiteUpdateInput,
  type MyAgencySiteResponse,
  type PublicAgencySite,
  type SiteSlugAvailability,
  type SiteSlugProblem,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AuditService } from '../../../common/audit/audit.service';
import { AppException } from '../../../common/errors/app.exception';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { agencySiteSelect, type AgencySiteRow } from '../agency-site.selects';
import { SITE_CACHE_TTL_SECONDS } from '../constants';
import { lockAgency, lockSiteSlug } from '../domain/locks';
import { isUniqueViolation } from '../domain/prisma-errors';
import { canRequestSite, isSiteServable, siteColor, toSiteView } from '../domain/sites';
import { AgenciesService } from './agencies.service';
import { AgencyCacheService } from './agency-cache.service';
import { AgencyPublicService } from './agency-public.service';
import { AgencySiteGateService } from './agency-site-gate.service';

/** Audit snapshot of a site (no PII: slug, colour, 한 줄 소개, status). */
export function siteAuditSnapshot(
  s: Pick<AgencySiteRow, 'status' | 'slug' | 'requestedSlug' | 'color' | 'tagline'> &
    Partial<Pick<AgencySiteRow, 'decisionReason'>>,
): Record<string, unknown> {
  return {
    status: s.status,
    slug: s.slug,
    requestedSlug: s.requestedSlug,
    color: s.color,
    tagline: s.tagline,
    ...(s.decisionReason !== undefined ? { decisionReason: s.decisionReason } : {}),
  };
}

/**
 * Another office already holds `slug`: as its approved slug (ACTIVE / SUSPENDED keep it) or as
 * an open (REQUESTED) request. The caller's own site never counts.
 */
export async function siteSlugTaken(
  db: PrismaTx,
  slug: string,
  agencyId: string,
): Promise<boolean> {
  const n = await db.agencySite.count({
    where: {
      agencyId: { not: agencyId },
      OR: [{ slug }, { requestedSlug: slug, status: AgencySiteStatus.REQUESTED }],
    },
  });
  return n > 0;
}

/**
 * 사무소 홈페이지 of the caller's office (request a slug, colour / 한 줄 소개) and the public read
 * GET /sites/:slug. Approval, rejection and suspension are admin decisions
 * (AgencySiteReviewService).
 */
@Injectable()
export class AgencySitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencies: AgenciesService,
    private readonly gate: AgencySiteGateService,
    private readonly cache: AgencyCacheService,
    private readonly publicAgencies: AgencyPublicService,
    private readonly audit: AuditService,
  ) {}

  /** Owner and staff of an APPROVED office (staff read only). */
  async getMine(user: UserPrincipal): Promise<MyAgencySiteResponse> {
    const member = await this.agencies.assertActiveMember(user.userId, user.agencyId);
    return this.mineOf(member.agencyId);
  }

  /** TAKEN = another office's approved slug or open request; the own request is available. */
  async availability(user: UserPrincipal, raw: string): Promise<SiteSlugAvailability> {
    const { agencyId } = await this.ownerOf(user);
    const slug = normalizeSiteSlug(raw);
    const problem = this.gate.slugProblem(slug);
    if (problem) return { slug, available: false, reason: problem };
    const taken = await siteSlugTaken(this.prisma, slug, agencyId);
    return { slug, available: !taken, reason: taken ? 'TAKEN' : null };
  }

  /**
   * Requests a slug, re-requests after a rejection, or changes a pending request. A site that is
   * ACTIVE / SUSPENDED keeps its slug (409 AGENCY_SITE_ALREADY_ACTIVE). Audited
   * `agency_site.request`.
   */
  async request(user: UserPrincipal, input: AgencySiteRequestInput): Promise<MyAgencySiteResponse> {
    const { agencyId } = await this.ownerOf(user);
    const slug = normalizeSiteSlug(input.slug);
    await this.prisma
      .$transaction(async (tx) => {
        await lockAgency(tx, agencyId);
        await lockSiteSlug(tx, slug);
        const before = await tx.agencySite.findUnique({
          where: { agencyId },
          select: agencySiteSelect,
        });
        if (before && !canRequestSite(before.status)) {
          throw AppException.conflict(ErrorCode.AGENCY_SITE_ALREADY_ACTIVE, {
            status: before.status,
          });
        }
        assertUsableSlug(this.gate.slugProblem(slug));
        if (await siteSlugTaken(tx, slug, agencyId)) {
          throw AppException.conflict(ErrorCode.AGENCY_SITE_SLUG_DUPLICATE);
        }
        const now = new Date();
        const fields = {
          status: AgencySiteStatus.REQUESTED,
          requestedSlug: slug,
          requestedAt: now,
          decidedAt: null,
          decidedByAdminId: null,
          decisionReason: null,
        };
        const after = await tx.agencySite.upsert({
          where: { agencyId },
          create: {
            agencyId,
            ...fields,
            color: input.color ?? DEFAULT_AGENCY_SITE_COLOR,
            tagline: input.tagline ?? null,
          },
          update: {
            ...fields,
            ...(input.color !== undefined ? { color: input.color } : {}),
            ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
          },
          select: agencySiteSelect,
        });
        await this.audit.record(
          {
            action: 'agency_site.request',
            resourceType: 'AgencySite',
            resourceId: after.id,
            before: before ? siteAuditSnapshot(before) : null,
            after: { ...siteAuditSnapshot(after), agencyId },
          },
          tx,
        );
      })
      .catch(rethrowSlugRace);
    return this.mineOf(agencyId);
  }

  /** Brand colour / 한 줄 소개, in any status. Audited `agency_site.update`; public cache bumped. */
  async update(user: UserPrincipal, input: AgencySiteUpdateInput): Promise<MyAgencySiteResponse> {
    const { agencyId } = await this.ownerOf(user);
    await this.prisma.$transaction(async (tx) => {
      await lockAgency(tx, agencyId);
      const before = await tx.agencySite.findUnique({
        where: { agencyId },
        select: agencySiteSelect,
      });
      if (!before) throw AppException.notFound(ErrorCode.AGENCY_SITE_NOT_FOUND);
      const after = await tx.agencySite.update({
        where: { id: before.id },
        data: {
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.tagline !== undefined ? { tagline: input.tagline } : {}),
        },
        select: agencySiteSelect,
      });
      await this.audit.record(
        {
          action: 'agency_site.update',
          resourceType: 'AgencySite',
          resourceId: before.id,
          before: { color: before.color, tagline: before.tagline },
          after: { color: after.color, tagline: after.tagline, agencyId },
        },
        tx,
      );
    });
    await this.cache.invalidatePublic();
    return this.mineOf(agencyId);
  }

  /**
   * GET /sites/:slug — a servable site (ACTIVE, office APPROVED and not deleted, subscription
   * gate) with the office's public profile. Cached in the public agency namespace, so every site,
   * agency, subscription or FEATURES change shows within one request.
   */
  async publicSite(rawSlug: string): Promise<PublicAgencySite> {
    const slug = normalizeSiteSlug(rawSlug);
    const key = await this.cache.publicKey('site', slug);
    const site = await this.cache.getOrSet<PublicAgencySite | null>(
      key,
      SITE_CACHE_TTL_SECONDS,
      () => this.loadPublicSite(slug),
    );
    if (!site) throw AppException.notFound(ErrorCode.AGENCY_SITE_NOT_FOUND);
    return site;
  }

  private async loadPublicSite(slug: string): Promise<PublicAgencySite | null> {
    const row = await this.prisma.agencySite.findFirst({
      where: {
        slug,
        status: AgencySiteStatus.ACTIVE,
        agency: { status: AgencyStatus.APPROVED, deletedAt: null },
      },
      select: { agencyId: true, status: true, slug: true, color: true, tagline: true },
    });
    if (!row?.slug) return null;
    const subscription = await this.gate.siteSubscription(row.agencyId);
    if (!isSiteServable(row, this.gate.context(true, subscription))) return null;
    let agency: AgencyProfile;
    try {
      agency = await this.publicAgencies.profile(row.agencyId);
    } catch (err) {
      if (err instanceof AppException && err.code === ErrorCode.AGENCY_NOT_FOUND) return null;
      throw err;
    }
    return {
      slug: row.slug,
      color: siteColor(row.color),
      tagline: row.tagline,
      url: this.gate.urlFor(row.slug),
      agency,
    };
  }

  private async mineOf(agencyId: string): Promise<MyAgencySiteResponse> {
    const [site, agency, subscription] = await Promise.all([
      this.prisma.agencySite.findUnique({ where: { agencyId }, select: agencySiteSelect }),
      this.prisma.agency.findUniqueOrThrow({
        where: { id: agencyId },
        select: { status: true, deletedAt: true },
      }),
      this.gate.siteSubscription(agencyId),
    ]);
    const live = agency.status === AgencyStatus.APPROVED && agency.deletedAt === null;
    return {
      site: site ? toSiteView(site, this.gate.context(live, subscription)) : null,
      rootDomain: this.gate.rootDomain,
      subscription,
    };
  }

  /** Writes and the availability check: the OWNER of an APPROVED office. */
  private ownerOf(user: UserPrincipal) {
    return this.agencies.assertActiveMember(user.userId, user.agencyId, { requireOwner: true });
  }
}

/**
 * Format and reserved words, from AgencySiteGateService.slugProblem (the request schemas check
 * the shared rules too; this also guards stored values and the admin host's label).
 */
export function assertUsableSlug(problem: SiteSlugProblem | null): void {
  if (problem === 'RESERVED') throw AppException.badRequest(ErrorCode.AGENCY_SITE_SLUG_RESERVED);
  if (problem === 'INVALID') throw AppException.badRequest(ErrorCode.AGENCY_SITE_SLUG_INVALID);
}

/**
 * Backstop for the partial unique indexes agency_sites_slug_key / ..._requested_slug_open_key
 * (agency_id is serialized by lockAgency, so a P2002 here is a slug race).
 */
export function rethrowSlugRace(err: unknown): never {
  if (isUniqueViolation(err)) throw AppException.conflict(ErrorCode.AGENCY_SITE_SLUG_DUPLICATE);
  throw err;
}
