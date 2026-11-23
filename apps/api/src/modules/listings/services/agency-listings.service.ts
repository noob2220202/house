import {
  AGENCY_EDITABLE_STATUSES,
  canAgencyTransition,
  checkPublishRequirements,
  ErrorCode,
  ListingAgencyStatus,
  ListingStatus,
  PUBLIC_LISTING_STATUSES,
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
import type { Listing, Prisma, Property } from '@prisma/client';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
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
  type AgencyMembershipPort,
  type ListingActor,
} from '../ports/agency-membership.port';
import { LISTING_MEDIA, type ListingMediaPort } from '../ports/listing-media.port';
import { ListingCountersService } from './listing-counters.service';

type ListingWithProperty = Listing & { property: Property };

const isPublic = (status: ListingStatus): boolean => PUBLIC_LISTING_STATUSES.includes(status);

/**
 * Agency (중개사무소) side of listings. Any ACTIVE member of a participating agency may edit
 * content, photos and 실매물 확인; status, publish and delete belong to the primary agency.
 * Listings the caller's agency doesn't participate in answer 404.
 */
@Injectable()
export class AgencyListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly mapper: ListingMapper,
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
        return rows.map((r) => this.mapper.summary(r));
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

  async update(
    principal: UserPrincipal,
    id: string,
    dto: ListingUpdateInput,
  ): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor);
    if (!AGENCY_EDITABLE_STATUSES.includes(current.status)) {
      throw AppException.badRequest(ErrorCode.LISTING_NOT_EDITABLE);
    }
    const propertyChanged = hasPropertyChanges(dto.property);
    let property = propertyStateFromRow(current.property);
    if (dto.property) {
      property = applyPropertyPatch(property, dto.property);
      if (dto.property.emdCode !== undefined) property.sggCode = this.sggCodeFor(property.emdCode);
      if (dto.property.complexId === null) property.areaTypeId = null;
    }
    const listing = applyListingPatch(listingStateFromRow(current), dto);
    const complexBuiltYear = await this.resolveComplex(property);
    const contact = dto.contact ? await this.resolveContact(actor, dto.contact) : null;

    if (isPublic(current.status)) {
      await this.assertPublishable(listing, property, current.primaryAgencyId);
    }

    await this.prisma.$transaction(async (tx) => {
      if (propertyChanged) {
        await tx.property.update({ where: { id: current.propertyId }, data: property });
        // Every listing of the property carries copies of its search columns.
        await tx.listing.updateMany({
          where: { propertyId: current.propertyId, id: { not: id } },
          data: propertySearchColumns(property, complexBuiltYear),
        });
      }
      await tx.listing.update({
        where: { id },
        data: listingWriteColumns(listing, property, complexBuiltYear),
      });
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

  /** Soft delete (primary agency only). */
  async remove(principal: UserPrincipal, id: string): Promise<void> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor, { primaryOnly: true });
    await this.prisma.$transaction(async (tx) => {
      await tx.listing.update({ where: { id }, data: { deletedAt: new Date() } });
      if (isPublic(current.status)) await this.refreshFor(tx, id, current.complexId);
    });
    if (isPublic(current.status)) await this.counters.invalidateSearch();
  }

  // ------------------------------------------------------------------ lifecycle

  /** DRAFT → ACTIVE after the 표시·광고 명시사항 check (primary agency only). */
  async publish(principal: UserPrincipal, id: string): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor, { primaryOnly: true });
    if (current.status !== ListingStatus.DRAFT) {
      throw AppException.badRequest(ErrorCode.LISTING_INVALID_STATUS_TRANSITION, {
        from: current.status,
        to: ListingStatus.ACTIVE,
      });
    }
    await this.assertPublishable(
      listingStateFromRow(current),
      propertyStateFromRow(current.property),
      current.primaryAgencyId,
    );
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.listing.updateMany({
        where: { id, status: ListingStatus.DRAFT, deletedAt: null },
        data: { status: ListingStatus.ACTIVE, publishedAt: new Date(), closedAt: null },
      });
      if (count === 0) throw AppException.conflict(ErrorCode.LISTING_INVALID_STATUS_TRANSITION);
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
        where: { id, status: current.status, deletedAt: null },
        data: { status: to, closedAt: to === ListingStatus.CLOSED ? new Date() : null },
      });
      if (count === 0) throw AppException.conflict(ErrorCode.LISTING_INVALID_STATUS_TRANSITION);
      if (isPublic(current.status) !== isPublic(to)) {
        await this.refreshFor(tx, id, current.complexId);
      }
    });
    await this.counters.invalidateSearch();
    return this.detail(id, actor);
  }

  // ------------------------------------------------------------------ 실매물 확인 / photos

  async addVerification(
    principal: UserPrincipal,
    id: string,
    dto: ListingVerificationInput,
  ): Promise<AgencyListingDetail> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor);
    this.assertEditable(current.status);
    if (dto.verifiedAt > kstToday()) {
      throw AppException.badRequest(ErrorCode.LISTING_VERIFICATION_FUTURE_DATE);
    }
    const verifiedAt = kstDayStart(dto.verifiedAt);
    await this.prisma.$transaction(async (tx) => {
      await tx.listingVerification.create({
        data: {
          listingId: id,
          method: dto.method,
          verifiedAt,
          note: dto.note ?? null,
          verifiedByUserId: actor.userId,
        },
      });
      // Keep the latest date: a back-dated record must not move verified_at backwards.
      await tx.$executeRaw`
        UPDATE listings SET verified_at = GREATEST(COALESCE(verified_at, ${verifiedAt}::timestamptz), ${verifiedAt}::timestamptz),
               updated_at = now()
        WHERE id = ${id}::uuid`;
    });
    return this.detail(id, actor);
  }

  /** Replaces the photo set in the given order; the cover defaults to the first photo. */
  async replacePhotos(
    principal: UserPrincipal,
    id: string,
    dto: ListingPhotosInput,
  ): Promise<PhotoUrls[]> {
    const actor = await this.membership.resolveActor(principal);
    const current = await this.loadForActor(id, actor);
    this.assertEditable(current.status);
    const ids = dto.photos.map((p) => p.mediaId);
    await this.media.assertUsableForListing(ids, { userId: actor.userId, listingId: id });
    const cover = dto.coverMediaId ?? ids[0];

    await this.prisma.$transaction(async (tx) => {
      await tx.listingPhoto.deleteMany({ where: { listingId: id } });
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
      await tx.listing.update({ where: { id }, data: { photoCount: dto.photos.length } });
    });
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
    return this.mapper.agencyDetail(row, actor.agencyId);
  }

  /**
   * Contact person for the acting agency's ListingAgency row. Defaults to the acting member;
   * an explicit member must be an ACTIVE member of the same agency.
   */
  async resolveContact(
    actor: ListingActor,
    input: ListingContactInput | undefined,
  ): Promise<{ contactMemberId: string; contactName: string; contactPhone: string | null }> {
    let member = { id: actor.memberId, displayName: actor.displayName, phone: actor.phone };
    if (input?.contactMemberId && input.contactMemberId !== actor.memberId) {
      const found = await this.membership.findActiveMember(actor.agencyId, input.contactMemberId);
      if (!found) throw AppException.badRequest(ErrorCode.LISTING_CONTACT_MEMBER_INVALID);
      member = found;
    }
    return {
      contactMemberId: member.id,
      contactName: input?.contactName ?? member.displayName,
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
