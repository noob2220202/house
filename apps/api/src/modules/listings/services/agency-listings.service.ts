import {
  AGENCY_EDITABLE_STATUSES,
  canAgencyTransition,
  checkPublishRequirements,
  DEFAULT_MAP_CENTER,
  DEFAULT_SGG_CODE,
  ErrorCode,
  floorWithinBuilding,
  ListingAgencyStatus,
  ListingStatus,
  PUBLIC_LISTING_STATUSES,
  ReportStatus,
  type AgencyListingDetail,
  type AgencyListingListQuery,
  type ListingContactInput,
  type ListingDraftInput,
  type ListingPhotosInput,
  type ListingStatusChangeInput,
  type ListingSummary,
  type ListingUpdateInput,
  type ListingVerificationInput,
  type Paginated,
  type PhotoUrls,
  type PublishCheckInput,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { Prisma, type Listing, type Property } from '@prisma/client';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { geoPoint } from '../../../common/geo/geo';
import { paginate } from '../../../common/pagination/pagination';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { EMD_MAX_DISTANCE_M, LISTING_AD_TTL_DAYS, SERVICE_REGION_RADIUS_M } from '../constants';
import { kstDayStart, kstToday } from '../domain/dates';
import {
  applyListingPatch,
  applyPropertyPatch,
  hasPropertyChanges,
  listingStateFromInput,
  listingStateFromRow,
  listingWriteColumns,
  propertyStateFromInput,
  propertyStateFromRow,
  publishCheckInput,
  type ListingState,
  type PropertyState,
} from '../domain/listing-state';
import { propertySearchColumns } from '../domain/search-columns';
import { ListingMapper } from '../listing.mapper';
import { LISTING_AGENCY_DETAIL_SELECT, LISTING_SUMMARY_SELECT } from '../listing.selects';
import {
  LISTING_AGENCY_MEMBERSHIP,
  mayBeAdvertised,
  type AgencyMemberRef,
  type AgencyMembershipPort,
  type ListingActor,
} from '../ports/agency-membership.port';
import { LISTING_MEDIA, type ListingMediaPort } from '../ports/listing-media.port';
import { ListingCountersService } from './listing-counters.service';
import { ListingRegionNamesService } from './listing-region-names.service';
import { ListingSummariesService } from './listing-summaries.service';

type ListingWithProperty = Listing & { property: Property };

export interface ResolvedContact {
  contactMemberId: string | null;
  contactName: string | null;
  contactPhone: string | null;
}

const isPublic = (status: ListingStatus): boolean => PUBLIC_LISTING_STATUSES.includes(status);
const DAY_MS = 86_400_000;
export const adExpiryFrom = (from: Date): Date =>
  new Date(from.getTime() + LISTING_AD_TTL_DAYS * DAY_MS);

/** Reports that are still being handled (the listing content is evidence). */
const OPEN_REPORT_STATUSES = [ReportStatus.RECEIVED, ReportStatus.IN_REVIEW];

const PUBLIC_STATUS_SQL = Prisma.join(
  PUBLIC_LISTING_STATUSES.map((s) => Prisma.sql`${s}::listing_status`),
);
const EDITABLE_STATUS_SQL = Prisma.join(
  AGENCY_EDITABLE_STATUSES.map((s) => Prisma.sql`${s}::listing_status`),
);

/** True when a PATCH changes the shared ad content (anything besides the caller's own contact). */
function touchesContent(dto: ListingUpdateInput): boolean {
  return Object.entries(dto).some(
    ([key, value]) => key !== 'contact' && key !== 'version' && value !== undefined,
  );
}

const concurrentModification = (): AppException =>
  AppException.conflict(ErrorCode.LISTING_CONCURRENT_MODIFICATION);

/**
 * Agency (중개사무소) side of listings. The primary agency owns the ad: content, photos, 실매물
 * 확인, status, publish and delete. Co-brokers (ACTIVE ListingAgency rows the primary accepted) may
 * read it and change only their own contact. Listings the caller's agency doesn't participate in
 * answer 404. Every content/status write is guarded by `listings.version` (409 on a lost race).
 */
@Injectable()
export class AgencyListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly mapper: ListingMapper,
    private readonly summaries: ListingSummariesService,
    private readonly regionNames: ListingRegionNamesService,
    private readonly counters: ListingCountersService,
    @Inject(LISTING_AGENCY_MEMBERSHIP) private readonly membership: AgencyMembershipPort,
    @Inject(LISTING_MEDIA) private readonly media: ListingMediaPort,
  ) {}

  // ------------------------------------------------------------------ reads

  async list(
    principal: UserPrincipal,
    q: AgencyListingListQuery,
  ): Promise<Paginated<ListingSummary>> {
    const actor = await this.membership.resolveActor(principal);
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      agencies: { some: { agencyId: actor.agencyId, status: ListingAgencyStatus.ACTIVE } },
      ...(q.primaryOnly ? { primaryAgencyId: actor.agencyId } : {}),
      ...(q.statuses?.length ? { status: { in: q.statuses } } : {}),
      ...(q.dealTypes?.length ? { dealType: { in: q.dealTypes } } : {}),
    };
    return paginate(
      q,
      async (args) => {
        const rows = await this.prisma.listing.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          select: LISTING_SUMMARY_SELECT,
          ...args,
        });
        return this.summaries.map(rows);
      },
      () => this.prisma.listing.count({ where }),
    );
  }

  async get(principal: UserPrincipal, id: string): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    await this.loadForActor(id, actor);
    return this.detail(id, actor);
  }

  // ------------------------------------------------------------------ create / update / delete

  async create(principal: UserPrincipal, dto: ListingDraftInput): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    const property = propertyStateFromInput(dto.property, this.sggCodeFor(dto.property.emdCode));
    await this.assertInServiceRegion(property);
    const listing = listingStateFromInput(dto);
    const complexBuiltYear = await this.resolveComplex(property);
    const contact = await this.resolveContact(actor, dto.contact);

    const id = await this.prisma.$transaction(async (tx) => {
      const createdProperty = await tx.property.create({
        data: { ...property, createdById: actor.userId },
        select: { id: true },
      });
      const created = await tx.listing.create({
        data: {
          ...listingWriteColumns(listing, property, complexBuiltYear),
          status: ListingStatus.DRAFT,
          propertyId: createdProperty.id,
          primaryAgencyId: actor.agencyId,
          createdById: actor.userId,
        },
        select: { id: true },
      });
      await tx.listingAgency.create({
        data: { listingId: created.id, agencyId: actor.agencyId, isPrimary: true, ...contact },
      });
      return created.id;
    });
    return this.detail(id, actor);
  }

  /**
   * PATCH. Content changes are primary-only; a co-broker may send only `contact` (its own row).
   * Edits of a public listing re-run the 명시사항 check.
   */
  async update(
    principal: UserPrincipal,
    id: string,
    dto: ListingUpdateInput,
  ): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor);
    this.assertEditable(current.status);
    if (dto.version !== undefined && dto.version !== current.version) {
      throw concurrentModification();
    }
    const contentChanged = touchesContent(dto);
    if (contentChanged && current.primaryAgencyId !== actor.agencyId) {
      throw AppException.forbidden(ErrorCode.LISTING_PRIMARY_AGENCY_ONLY);
    }
    const contact = dto.contact ? await this.resolveContact(actor, dto.contact) : null;

    if (!contentChanged) {
      if (contact) {
        await this.prisma.listingAgency.update({
          where: { listingId_agencyId: { listingId: id, agencyId: actor.agencyId } },
          data: contact,
        });
      }
      return this.detail(id, actor);
    }

    const propertyChanged = hasPropertyChanges(dto.property);
    let property = propertyStateFromRow(current.property);
    if (dto.property) {
      property = applyPropertyPatch(property, dto.property);
      if (dto.property.emdCode !== undefined) property.sggCode = this.sggCodeFor(property.emdCode);
      if (dto.property.complexId === null) property.areaTypeId = null;
      if (!floorWithinBuilding(property.floor, property.totalFloors)) {
        throw AppException.badRequest(ErrorCode.LISTING_FLOOR_INVALID);
      }
      if (
        dto.property.lat !== undefined ||
        dto.property.lng !== undefined ||
        dto.property.emdCode !== undefined
      ) {
        await this.assertInServiceRegion(property);
      }
    }
    const listing = applyListingPatch(listingStateFromRow(current), dto);
    const complexBuiltYear = await this.resolveComplex(property);

    if (isPublic(current.status)) {
      await this.assertPublishable(listing, property, current.primaryAgencyId);
    }

    await this.prisma.$transaction(async (tx) => {
      // Guarded write first: a concurrent publish/status change/edit bumps `version` and makes
      // this a no-op, so a stale merge can never overwrite newer data or skip the publish check.
      const { count } = await tx.listing.updateMany({
        where: { id, status: current.status, version: current.version, deletedAt: null },
        data: {
          ...listingWriteColumns(listing, property, complexBuiltYear),
          version: { increment: 1 },
        },
      });
      if (count === 0) throw concurrentModification();
      if (propertyChanged) {
        await tx.property.update({ where: { id: current.propertyId }, data: property });
        // Every listing of the property carries copies of its search columns.
        await tx.listing.updateMany({
          where: { propertyId: current.propertyId, id: { not: id } },
          data: propertySearchColumns(property, complexBuiltYear),
        });
      }
      if (contact) {
        await tx.listingAgency.update({
          where: { listingId_agencyId: { listingId: id, agencyId: actor.agencyId } },
          data: contact,
        });
      }
      if (isPublic(current.status) && property.complexId !== current.property.complexId) {
        await this.counters.refresh(tx, {
          complexIds: [current.property.complexId, property.complexId],
        });
      }
    });
    if (isPublic(current.status)) await this.counters.invalidateSearch();
    return this.detail(id, actor);
  }

  /**
   * Soft delete (primary agency only). Hidden listings and listings with open reports are kept:
   * they are evidence for the 허위매물 신고 workflow.
   */
  async remove(principal: UserPrincipal, id: string): Promise<void> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor, { primaryOnly: true });
    if (current.status === ListingStatus.HIDDEN) {
      throw AppException.badRequest(ErrorCode.LISTING_NOT_EDITABLE);
    }
    const openReports = await this.prisma.report.count({
      where: { listingId: id, status: { in: OPEN_REPORT_STATUSES } },
    });
    if (openReports > 0) throw AppException.badRequest(ErrorCode.LISTING_UNDER_REVIEW);
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.listing.updateMany({
        where: { id, version: current.version, status: current.status, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
      if (count === 0) throw concurrentModification();
      if (isPublic(current.status)) await this.refreshFor(tx, id, current.complexId);
    });
    if (isPublic(current.status)) await this.counters.invalidateSearch();
  }

  // ------------------------------------------------------------------ lifecycle

  /**
   * DRAFT → ACTIVE after the 표시·광고 명시사항 check (primary agency only). The first publication
   * time is kept, so taking an ad down and republishing it does not bump it to the top of 최신순.
   * Every publication starts a new ad period (expiresAt).
   */
  async publish(principal: UserPrincipal, id: string): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor, { primaryOnly: true });
    if (current.status !== ListingStatus.DRAFT) {
      throw AppException.badRequest(ErrorCode.LISTING_INVALID_STATUS_TRANSITION, {
        from: current.status,
        to: ListingStatus.ACTIVE,
      });
    }
    const property = propertyStateFromRow(current.property);
    await this.assertInServiceRegion(property);
    await this.assertPublishable(listingStateFromRow(current), property, current.primaryAgencyId);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.listing.updateMany({
        where: { id, status: ListingStatus.DRAFT, version: current.version, deletedAt: null },
        data: {
          status: ListingStatus.ACTIVE,
          publishedAt: current.publishedAt ?? now,
          expiresAt: adExpiryFrom(now),
          closedAt: null,
          version: { increment: 1 },
        },
      });
      if (count === 0) throw concurrentModification();
      await this.refreshFor(tx, id, current.complexId);
    });
    await this.counters.invalidateSearch();
    return this.detail(id, actor);
  }

  async changeStatus(
    principal: UserPrincipal,
    id: string,
    dto: ListingStatusChangeInput,
  ): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor, { primaryOnly: true });
    const to = dto.status;
    if (!canAgencyTransition(current.status, to)) {
      throw AppException.badRequest(ErrorCode.LISTING_INVALID_STATUS_TRANSITION, {
        from: current.status,
        to,
      });
    }
    if (to === ListingStatus.ACTIVE) {
      await this.assertPublishable(
        listingStateFromRow(current),
        propertyStateFromRow(current.property),
        current.primaryAgencyId,
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.listing.updateMany({
        where: { id, status: current.status, version: current.version, deletedAt: null },
        data: {
          status: to,
          closedAt: to === ListingStatus.CLOSED ? new Date() : null,
          version: { increment: 1 },
        },
      });
      if (count === 0) throw concurrentModification();
      if (isPublic(current.status) !== isPublic(to)) {
        await this.refreshFor(tx, id, current.complexId);
      }
    });
    await this.counters.invalidateSearch();
    return this.detail(id, actor);
  }

  // ------------------------------------------------------------------ 실매물 확인 / photos

  /** 실매물 확인 (primary only). A public ad's period is extended from the 확인일. */
  async addVerification(
    principal: UserPrincipal,
    id: string,
    dto: ListingVerificationInput,
  ): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor, { primaryOnly: true });
    this.assertEditable(current.status);
    if (dto.verifiedAt > kstToday()) {
      throw AppException.badRequest(ErrorCode.LISTING_VERIFICATION_FUTURE_DATE);
    }
    const verifiedAt = kstDayStart(dto.verifiedAt);
    const extendedTo = adExpiryFrom(verifiedAt);
    await this.prisma.$transaction(async (tx) => {
      // Keep the latest date: a back-dated record must not move verified_at (or expiry) backwards.
      const updated = await tx.$executeRaw`
        UPDATE listings
        SET verified_at = GREATEST(COALESCE(verified_at, ${verifiedAt}::timestamptz), ${verifiedAt}::timestamptz),
            expires_at = CASE WHEN status IN (${PUBLIC_STATUS_SQL})
              THEN GREATEST(COALESCE(expires_at, ${extendedTo}::timestamptz), ${extendedTo}::timestamptz)
              ELSE expires_at END,
            version = version + 1,
            updated_at = now()
        WHERE id = ${id}::uuid AND deleted_at IS NULL AND status IN (${EDITABLE_STATUS_SQL})`;
      if (updated === 0) throw concurrentModification();
      await tx.listingVerification.create({
        data: {
          listingId: id,
          method: dto.method,
          verifiedAt,
          note: dto.note ?? null,
          verifiedByUserId: actor.userId,
        },
      });
    });
    return this.detail(id, actor);
  }

  /** Replaces the photo set in the given order (primary only); the cover defaults to the first. */
  async replacePhotos(
    principal: UserPrincipal,
    id: string,
    dto: ListingPhotosInput,
  ): Promise<PhotoUrls[]> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor, { primaryOnly: true });
    this.assertEditable(current.status);
    const ids = dto.photos.map((p) => p.mediaId);
    const cover = dto.coverMediaId ?? ids[0];

    await this.prisma.$transaction(async (tx) => {
      await this.media.assertUsableForListing(ids, { userId: actor.userId, listingId: id }, tx);
      const { count } = await tx.listing.updateMany({
        where: { id, deletedAt: null, status: { in: [...AGENCY_EDITABLE_STATUSES] } },
        data: { photoCount: dto.photos.length, version: { increment: 1 } },
      });
      if (count === 0) throw concurrentModification();
      const previous = await tx.listingPhoto.findMany({
        where: { listingId: id },
        select: { mediaId: true },
      });
      await tx.listingPhoto.deleteMany({ where: { listingId: id } });
      const kept = new Set(ids);
      await this.media.released(
        previous.map((p) => p.mediaId).filter((m) => !kept.has(m)),
        tx,
      );
      if (dto.photos.length > 0) {
        await tx.listingPhoto.createMany({
          data: dto.photos.map((p, i) => ({
            listingId: id,
            mediaId: p.mediaId,
            sortOrder: i,
            caption: p.caption ?? null,
            isCover: p.mediaId === cover,
          })),
        });
      }
    });
    if (isPublic(current.status)) await this.counters.invalidateSearch();
    const rows = await this.prisma.listingPhoto.findMany({
      where: { listingId: id },
      orderBy: { sortOrder: 'asc' },
      select: {
        mediaId: true,
        caption: true,
        isCover: true,
        media: { select: { storageKey: true, variants: true } },
      },
    });
    return rows.map((r) => this.mapper.photo(r));
  }

  // ------------------------------------------------------------------ helpers (also used by co-brokerage)

  /** The listing if the actor's agency participates (ACTIVE) in it, else 404. */
  async loadForActor(
    id: string,
    actor: ListingActor,
    opts: { primaryOnly?: boolean } = {},
  ): Promise<ListingWithProperty> {
    const listing = await this.prisma.listing.findFirst({
      where: {
        id,
        deletedAt: null,
        agencies: { some: { agencyId: actor.agencyId, status: ListingAgencyStatus.ACTIVE } },
      },
      include: { property: true },
    });
    if (!listing) throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
    if (opts.primaryOnly && listing.primaryAgencyId !== actor.agencyId) {
      throw AppException.forbidden(ErrorCode.LISTING_PRIMARY_AGENCY_ONLY);
    }
    return listing;
  }

  async detail(id: string, actor: ListingActor): Promise<AgencyListingDetail> {
    const row = await this.prisma.listing.findUniqueOrThrow({
      where: { id },
      select: LISTING_AGENCY_DETAIL_SELECT,
    });
    return this.mapper.agencyDetail(
      row,
      actor.agencyId,
      await this.regionNames.nameOf(row.emdCode),
    );
  }

  /**
   * Public contact person for the acting agency's ListingAgency row. 공인중개사법 제18조의2①: an ad
   * must not show a 중개보조원, so the contact is always the 개업공인중개사 (OWNER) or a
   * 소속공인중개사. Defaults to the acting member when licensed, else the agency's representative
   * (or no personal contact, so only the agency phone shows). An explicit member must be licensed;
   * a phone override is accepted only from a licensed acting member.
   */
  async resolveContact(
    actor: ListingActor,
    input: ListingContactInput | undefined,
  ): Promise<ResolvedContact> {
    const self: AgencyMemberRef = {
      id: actor.memberId,
      displayName: actor.displayName,
      phone: actor.phone,
      role: actor.role,
      isLicensed: actor.isLicensed,
    };
    let member: AgencyMemberRef | null;
    if (input?.contactMemberId) {
      member =
        input.contactMemberId === actor.memberId
          ? self
          : await this.membership.findActiveMember(actor.agencyId, input.contactMemberId);
      if (!member || !mayBeAdvertised(member)) {
        throw AppException.badRequest(ErrorCode.LISTING_CONTACT_MEMBER_INVALID);
      }
    } else {
      member = mayBeAdvertised(self)
        ? self
        : await this.membership.findRepresentative(actor.agencyId);
    }
    if (input?.contactPhone !== undefined && (!mayBeAdvertised(self) || !member)) {
      throw AppException.badRequest(ErrorCode.LISTING_CONTACT_MEMBER_INVALID);
    }
    if (!member) return { contactMemberId: null, contactName: null, contactPhone: null };
    return {
      contactMemberId: member.id,
      contactName: member.displayName,
      contactPhone: input?.contactPhone ?? member.phone,
    };
  }

  /** Recomputes counters for the listing's complex and all of its participating agencies. */
  async refreshFor(tx: PrismaTx, listingId: string, complexId: string | null): Promise<void> {
    const agencies = await tx.listingAgency.findMany({
      where: { listingId },
      select: { agencyId: true },
    });
    await this.counters.refresh(tx, {
      complexIds: [complexId],
      agencyIds: agencies.map((a) => a.agencyId),
    });
  }

  private assertEditable(status: ListingStatus): void {
    if (!AGENCY_EDITABLE_STATUSES.includes(status)) {
      throw AppException.badRequest(ErrorCode.LISTING_NOT_EDITABLE);
    }
  }

  private async assertPublishable(
    listing: ListingState,
    property: PropertyState,
    primaryAgencyId: string,
  ): Promise<void> {
    const agency = await this.prisma.agency.findUnique({
      where: { id: primaryAgencyId },
      select: {
        name: true,
        roadAddress: true,
        phone: true,
        registrationNumber: true,
        representativeName: true,
      },
    });
    const issues = checkPublishRequirements(
      publishCheckInput(listing, property, agency satisfies PublishCheckInput['agency']),
    );
    if (issues.length > 0) {
      throw AppException.badRequest(ErrorCode.LISTING_PUBLISH_REQUIREMENTS, issues);
    }
  }

  /** The service region is one 시군구 (REGION_SGG_CODE); 법정동 codes elsewhere are rejected. */
  private sggCodeFor(emdCode: string | null | undefined): string {
    const sgg = this.config.get('REGION_SGG_CODE');
    if (emdCode && !emdCode.startsWith(sgg)) {
      throw AppException.badRequest(ErrorCode.LISTING_REGION_NOT_SUPPORTED);
    }
    return sgg;
  }

  /**
   * The map position must lie in the service region: within SERVICE_REGION_RADIUS_M of the
   * 시군구 centroid (regions row; the built-in 순천시 centre when that row is missing) and, when the
   * 법정동 has a centroid, within EMD_MAX_DISTANCE_M of it. Unknown centroids skip that check.
   */
  private async assertInServiceRegion(p: PropertyState): Promise<void> {
    const sgg = this.config.get('REGION_SGG_CODE');
    const fallback =
      sgg === DEFAULT_SGG_CODE
        ? geoPoint(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng)
        : Prisma.sql`NULL::geography`;
    const point = geoPoint(p.lat, p.lng);
    const [row] = await this.prisma.$queryRaw<{ inSgg: boolean | null; nearEmd: boolean | null }[]>`
      SELECT
        ST_DWithin(${point},
          COALESCE((SELECT r.location FROM regions r WHERE r.code = ${sgg}), ${fallback}),
          ${SERVICE_REGION_RADIUS_M}) AS "inSgg",
        (SELECT ST_DWithin(r.location, ${point}, ${EMD_MAX_DISTANCE_M})
           FROM regions r WHERE r.code = ${p.emdCode}) AS "nearEmd"`;
    if (row?.inSgg === false || row?.nearEmd === false) {
      throw AppException.badRequest(ErrorCode.LISTING_REGION_NOT_SUPPORTED);
    }
  }

  /** Validates complex/평형 references; returns the complex's 준공년도 (search fallback). */
  private async resolveComplex(p: PropertyState): Promise<number | null> {
    if (!p.complexId) {
      if (p.areaTypeId) throw AppException.badRequest(ErrorCode.LISTING_COMPLEX_INVALID);
      return null;
    }
    const complex = await this.prisma.complex.findFirst({
      where: { id: p.complexId, deletedAt: null },
      select: { builtYear: true },
    });
    if (!complex) throw AppException.badRequest(ErrorCode.LISTING_COMPLEX_INVALID);
    if (p.areaTypeId) {
      const n = await this.prisma.complexAreaType.count({
        where: { id: p.areaTypeId, complexId: p.complexId },
      });
      if (n === 0) throw AppException.badRequest(ErrorCode.LISTING_COMPLEX_INVALID);
    }
    return complex.builtYear;
  }
}
