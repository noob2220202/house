"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencyListingsService = exports.adExpiryFrom = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const app_exception_1 = require("../../../common/errors/app.exception");
const geo_1 = require("../../../common/geo/geo");
const pagination_1 = require("../../../common/pagination/pagination");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const dates_1 = require("../domain/dates");
const listing_state_1 = require("../domain/listing-state");
const search_columns_1 = require("../domain/search-columns");
const listing_search_repository_1 = require("../listing-search.repository");
const listing_mapper_1 = require("../listing.mapper");
const listing_selects_1 = require("../listing.selects");
const agency_membership_port_1 = require("../ports/agency-membership.port");
const listing_media_port_1 = require("../ports/listing-media.port");
const agency_console_service_1 = require("./agency-console.service");
const listing_counters_service_1 = require("./listing-counters.service");
const listing_region_names_service_1 = require("./listing-region-names.service");
const listing_summaries_service_1 = require("./listing-summaries.service");
const isPublic = (status) => shared_1.PUBLIC_LISTING_STATUSES.includes(status);
const DAY_MS = 86_400_000;
const adExpiryFrom = (from) => new Date(from.getTime() + constants_1.LISTING_AD_TTL_DAYS * DAY_MS);
exports.adExpiryFrom = adExpiryFrom;
/** Reports that are still being handled (the listing content is evidence). */
const OPEN_REPORT_STATUSES = [shared_1.ReportStatus.RECEIVED, shared_1.ReportStatus.IN_REVIEW];
const PUBLIC_STATUS_SQL = client_1.Prisma.join(shared_1.PUBLIC_LISTING_STATUSES.map((s) => client_1.Prisma.sql `${s}::listing_status`));
const EDITABLE_STATUS_SQL = client_1.Prisma.join(shared_1.AGENCY_EDITABLE_STATUSES.map((s) => client_1.Prisma.sql `${s}::listing_status`));
/** True when a PATCH changes the shared ad content (anything besides the caller's own contact). */
function touchesContent(dto) {
    return Object.entries(dto).some(([key, value]) => key !== 'contact' && key !== 'version' && value !== undefined);
}
const concurrentModification = () => app_exception_1.AppException.conflict(shared_1.ErrorCode.LISTING_CONCURRENT_MODIFICATION);
/** Console list order per sort key (id last, so pages never overlap). */
const AGENCY_LIST_ORDER = {
    UPDATED: [{ updatedAt: 'desc' }, { id: 'desc' }],
    LATEST: [{ createdAt: 'desc' }, { id: 'desc' }],
    // Oldest 확인 first = the soonest deadline; never verified last (no deadline to show).
    VERIFY_DUE: [{ verifiedAt: { sort: 'asc', nulls: 'last' } }, { id: 'desc' }],
    PRICE_DESC: [{ priceSort: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
    PRICE_ASC: [{ priceSort: { sort: 'asc', nulls: 'last' } }, { id: 'desc' }],
    VIEWS: [{ viewCount: 'desc' }, { updatedAt: 'desc' }, { id: 'desc' }],
};
const PUBLISH_AGENCY_SELECT = {
    name: true,
    roadAddress: true,
    phone: true,
    registrationNumber: true,
    representativeName: true,
};
/**
 * Agency (중개사무소) side of listings. The primary agency owns the ad: content, photos, 실매물
 * 확인, status, publish and delete. Co-brokers (ACTIVE ListingAgency rows the primary accepted) may
 * read it and change only their own contact. Listings the caller's agency doesn't participate in
 * answer 404. Every content/status write is guarded by `listings.version` (409 on a lost race).
 */
let AgencyListingsService = class AgencyListingsService {
    constructor(prisma, config, mapper, summaries, search, regionNames, counters, membership, media) {
        this.prisma = prisma;
        this.config = config;
        this.mapper = mapper;
        this.summaries = summaries;
        this.search = search;
        this.regionNames = regionNames;
        this.counters = counters;
        this.membership = membership;
        this.media = media;
    }
    // ------------------------------------------------------------------ reads
    /**
     * The console list: listings the acting agency participates in (ACTIVE membership; own and
     * co-brokered). Filters: statuses, deal / asset types, text (`q`, see
     * ListingSearchRepository.agencyTextMatchIds), 실매물 확인 due (same rule as the summary chip),
     * co-brokered only / primary only.
     */
    async list(principal, q, now = new Date()) {
        const actor = await this.membership.resolveActor(principal);
        const and = [
            {
                deletedAt: null,
                agencies: { some: { agencyId: actor.agencyId, status: shared_1.ListingAgencyStatus.ACTIVE } },
            },
        ];
        if (q.primaryOnly)
            and.push({ primaryAgencyId: actor.agencyId });
        if (q.coBrokered)
            and.push({ primaryAgencyId: { not: actor.agencyId } });
        if (q.statuses?.length)
            and.push({ status: { in: q.statuses } });
        if (q.dealTypes?.length)
            and.push({ dealType: { in: q.dealTypes } });
        if (q.assetTypes?.length)
            and.push({ assetType: { in: q.assetTypes } });
        if (q.verificationDue) {
            and.push({
                status: { in: [...shared_1.PUBLIC_LISTING_STATUSES] },
                OR: [{ verifiedAt: null }, { verifiedAt: { lt: (0, agency_console_service_1.verificationDueBefore)(now) } }],
            });
        }
        if (q.q) {
            const ids = await this.search.agencyTextMatchIds(actor.agencyId, q.q, (0, shared_1.parseListingNo)(q.q));
            and.push({ id: { in: ids } });
        }
        const where = { AND: and };
        return (0, pagination_1.paginate)(q, async (args) => {
            const rows = await this.prisma.listing.findMany({
                where,
                orderBy: AGENCY_LIST_ORDER[q.sort],
                select: listing_selects_1.LISTING_AGENCY_ROW_SELECT,
                ...args,
            });
            const drafts = rows.filter((r) => r.status === shared_1.ListingStatus.DRAFT).map((r) => r.id);
            return this.summaries.mapForAgency(rows, actor.agencyId, await this.missingCounts(drafts));
        }, () => this.prisma.listing.count({ where }));
    }
    /** Number of missing 명시사항 per draft (shared checkPublishRequirements, as publish checks). */
    async missingCounts(ids) {
        if (ids.length === 0)
            return new Map();
        const rows = await this.prisma.listing.findMany({
            where: { id: { in: ids } },
            include: { property: true, primaryAgency: { select: PUBLISH_AGENCY_SELECT } },
        });
        return new Map(rows.map((r) => [
            r.id,
            (0, shared_1.checkPublishRequirements)((0, listing_state_1.publishCheckInput)((0, listing_state_1.listingStateFromRow)(r), (0, listing_state_1.propertyStateFromRow)(r.property), r.primaryAgency)).length,
        ]));
    }
    async get(principal, id) {
        const actor = await this.membership.resolveActor(principal);
        await this.loadForActor(id, actor);
        return this.detail(id, actor);
    }
    // ------------------------------------------------------------------ create / update / delete
    async create(principal, dto) {
        const actor = await this.membership.resolveActor(principal);
        const property = (0, listing_state_1.propertyStateFromInput)(dto.property, this.sggCodeFor(dto.property.emdCode));
        await this.assertInServiceRegion(property);
        const listing = (0, listing_state_1.listingStateFromInput)(dto);
        const complexBuiltYear = await this.resolveComplex(property);
        const contact = await this.resolveContact(actor, dto.contact);
        const id = await this.prisma.$transaction(async (tx) => {
            const createdProperty = await tx.property.create({
                data: { ...property, createdById: actor.userId },
                select: { id: true },
            });
            const created = await tx.listing.create({
                data: {
                    ...(0, listing_state_1.listingWriteColumns)(listing, property, complexBuiltYear),
                    status: shared_1.ListingStatus.DRAFT,
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
    async update(principal, id, dto) {
        const actor = await this.membership.resolveActor(principal);
        const current = await this.loadForActor(id, actor);
        this.assertEditable(current.status);
        if (dto.version !== undefined && dto.version !== current.version) {
            throw concurrentModification();
        }
        const contentChanged = touchesContent(dto);
        if (contentChanged && current.primaryAgencyId !== actor.agencyId) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.LISTING_PRIMARY_AGENCY_ONLY);
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
        const propertyChanged = (0, listing_state_1.hasPropertyChanges)(dto.property);
        let property = (0, listing_state_1.propertyStateFromRow)(current.property);
        if (dto.property) {
            property = (0, listing_state_1.applyPropertyPatch)(property, dto.property);
            if (dto.property.emdCode !== undefined)
                property.sggCode = this.sggCodeFor(property.emdCode);
            if (dto.property.complexId === null)
                property.areaTypeId = null;
            if (!(0, shared_1.floorWithinBuilding)(property.floor, property.totalFloors)) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_FLOOR_INVALID);
            }
            if (dto.property.lat !== undefined ||
                dto.property.lng !== undefined ||
                dto.property.emdCode !== undefined) {
                await this.assertInServiceRegion(property);
            }
        }
        const listing = (0, listing_state_1.applyListingPatch)((0, listing_state_1.listingStateFromRow)(current), dto);
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
                    ...(0, listing_state_1.listingWriteColumns)(listing, property, complexBuiltYear),
                    version: { increment: 1 },
                },
            });
            if (count === 0)
                throw concurrentModification();
            if (propertyChanged) {
                await tx.property.update({ where: { id: current.propertyId }, data: property });
                // Every listing of the property carries copies of its search columns.
                await tx.listing.updateMany({
                    where: { propertyId: current.propertyId, id: { not: id } },
                    data: (0, search_columns_1.propertySearchColumns)(property, complexBuiltYear),
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
        if (isPublic(current.status))
            await this.counters.invalidateSearch();
        return this.detail(id, actor);
    }
    /**
     * Soft delete (primary agency only). Hidden listings and listings with open reports are kept:
     * they are evidence for the 허위매물 신고 workflow.
     */
    async remove(principal, id) {
        const actor = await this.membership.resolveActor(principal);
        const current = await this.loadForActor(id, actor, { primaryOnly: true });
        if (current.status === shared_1.ListingStatus.HIDDEN) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_NOT_EDITABLE);
        }
        const openReports = await this.prisma.report.count({
            where: { listingId: id, status: { in: OPEN_REPORT_STATUSES } },
        });
        if (openReports > 0)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_UNDER_REVIEW);
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.listing.updateMany({
                where: { id, version: current.version, status: current.status, deletedAt: null },
                data: { deletedAt: new Date(), version: { increment: 1 } },
            });
            if (count === 0)
                throw concurrentModification();
            if (isPublic(current.status))
                await this.refreshFor(tx, id, current.complexId);
        });
        if (isPublic(current.status))
            await this.counters.invalidateSearch();
    }
    // ------------------------------------------------------------------ lifecycle
    /**
     * DRAFT → ACTIVE after the 표시·광고 명시사항 check (primary agency only). The first publication
     * time is kept, so taking an ad down and republishing it does not bump it to the top of 최신순.
     * Every publication starts a new ad period (expiresAt).
     */
    async publish(principal, id) {
        const actor = await this.membership.resolveActor(principal);
        const current = await this.loadForActor(id, actor, { primaryOnly: true });
        if (current.status !== shared_1.ListingStatus.DRAFT) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_INVALID_STATUS_TRANSITION, {
                from: current.status,
                to: shared_1.ListingStatus.ACTIVE,
            });
        }
        const property = (0, listing_state_1.propertyStateFromRow)(current.property);
        await this.assertInServiceRegion(property);
        await this.assertPublishable((0, listing_state_1.listingStateFromRow)(current), property, current.primaryAgencyId);
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.listing.updateMany({
                where: { id, status: shared_1.ListingStatus.DRAFT, version: current.version, deletedAt: null },
                data: {
                    status: shared_1.ListingStatus.ACTIVE,
                    publishedAt: current.publishedAt ?? now,
                    expiresAt: (0, exports.adExpiryFrom)(now),
                    closedAt: null,
                    version: { increment: 1 },
                },
            });
            if (count === 0)
                throw concurrentModification();
            await this.refreshFor(tx, id, current.complexId);
        });
        await this.counters.invalidateSearch();
        return this.detail(id, actor);
    }
    async changeStatus(principal, id, dto) {
        const actor = await this.membership.resolveActor(principal);
        const current = await this.loadForActor(id, actor, { primaryOnly: true });
        const to = dto.status;
        if (!(0, shared_1.canAgencyTransition)(current.status, to)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_INVALID_STATUS_TRANSITION, {
                from: current.status,
                to,
            });
        }
        if (to === shared_1.ListingStatus.ACTIVE) {
            await this.assertPublishable((0, listing_state_1.listingStateFromRow)(current), (0, listing_state_1.propertyStateFromRow)(current.property), current.primaryAgencyId);
        }
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.listing.updateMany({
                where: { id, status: current.status, version: current.version, deletedAt: null },
                data: {
                    status: to,
                    closedAt: to === shared_1.ListingStatus.CLOSED ? new Date() : null,
                    version: { increment: 1 },
                },
            });
            if (count === 0)
                throw concurrentModification();
            if (isPublic(current.status) !== isPublic(to)) {
                await this.refreshFor(tx, id, current.complexId);
            }
        });
        await this.counters.invalidateSearch();
        return this.detail(id, actor);
    }
    // ------------------------------------------------------------------ 실매물 확인 / photos
    /** 실매물 확인 (primary only). A public ad's period is extended from the 확인일. */
    async addVerification(principal, id, dto) {
        const actor = await this.membership.resolveActor(principal);
        const current = await this.loadForActor(id, actor, { primaryOnly: true });
        this.assertEditable(current.status);
        if (dto.verifiedAt > (0, dates_1.kstToday)()) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_VERIFICATION_FUTURE_DATE);
        }
        const verifiedAt = (0, dates_1.kstDayStart)(dto.verifiedAt);
        const extendedTo = (0, exports.adExpiryFrom)(verifiedAt);
        await this.prisma.$transaction(async (tx) => {
            // Keep the latest date: a back-dated record must not move verified_at (or expiry) backwards.
            const updated = await tx.$executeRaw `
        UPDATE listings
        SET verified_at = GREATEST(COALESCE(verified_at, ${verifiedAt}::timestamptz), ${verifiedAt}::timestamptz),
            expires_at = CASE WHEN status IN (${PUBLIC_STATUS_SQL})
              THEN GREATEST(COALESCE(expires_at, ${extendedTo}::timestamptz), ${extendedTo}::timestamptz)
              ELSE expires_at END,
            version = version + 1,
            updated_at = now()
        WHERE id = ${id}::uuid AND deleted_at IS NULL AND status IN (${EDITABLE_STATUS_SQL})`;
            if (updated === 0)
                throw concurrentModification();
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
    async replacePhotos(principal, id, dto) {
        const actor = await this.membership.resolveActor(principal);
        const current = await this.loadForActor(id, actor, { primaryOnly: true });
        this.assertEditable(current.status);
        const ids = dto.photos.map((p) => p.mediaId);
        const cover = dto.coverMediaId ?? ids[0];
        await this.prisma.$transaction(async (tx) => {
            await this.media.assertUsableForListing(ids, { userId: actor.userId, listingId: id }, tx);
            const { count } = await tx.listing.updateMany({
                where: { id, deletedAt: null, status: { in: [...shared_1.AGENCY_EDITABLE_STATUSES] } },
                data: { photoCount: dto.photos.length, version: { increment: 1 } },
            });
            if (count === 0)
                throw concurrentModification();
            const previous = await tx.listingPhoto.findMany({
                where: { listingId: id },
                select: { mediaId: true },
            });
            await tx.listingPhoto.deleteMany({ where: { listingId: id } });
            const kept = new Set(ids);
            await this.media.released(previous.map((p) => p.mediaId).filter((m) => !kept.has(m)), tx);
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
        if (isPublic(current.status))
            await this.counters.invalidateSearch();
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
    async loadForActor(id, actor, opts = {}) {
        const listing = await this.prisma.listing.findFirst({
            where: {
                id,
                deletedAt: null,
                agencies: { some: { agencyId: actor.agencyId, status: shared_1.ListingAgencyStatus.ACTIVE } },
            },
            include: { property: true },
        });
        if (!listing)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.LISTING_NOT_FOUND);
        if (opts.primaryOnly && listing.primaryAgencyId !== actor.agencyId) {
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.LISTING_PRIMARY_AGENCY_ONLY);
        }
        return listing;
    }
    async detail(id, actor) {
        const row = await this.prisma.listing.findUniqueOrThrow({
            where: { id },
            select: listing_selects_1.LISTING_AGENCY_DETAIL_SELECT,
        });
        return this.mapper.agencyDetail(row, actor.agencyId, await this.regionNames.nameOf(row.emdCode));
    }
    /**
     * Public contact person for the acting agency's ListingAgency row. 공인중개사법 제18조의2①: an ad
     * must not show a 중개보조원, so the contact is always the 개업공인중개사 (OWNER) or a
     * 소속공인중개사. Defaults to the acting member when licensed, else the agency's representative
     * (or no personal contact, so only the agency phone shows). An explicit member must be licensed;
     * a phone override is accepted only from a licensed acting member.
     */
    async resolveContact(actor, input) {
        const self = {
            id: actor.memberId,
            displayName: actor.displayName,
            phone: actor.phone,
            role: actor.role,
            isLicensed: actor.isLicensed,
        };
        let member;
        if (input?.contactMemberId) {
            member =
                input.contactMemberId === actor.memberId
                    ? self
                    : await this.membership.findActiveMember(actor.agencyId, input.contactMemberId);
            if (!member || !(0, agency_membership_port_1.mayBeAdvertised)(member)) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_CONTACT_MEMBER_INVALID);
            }
        }
        else {
            member = (0, agency_membership_port_1.mayBeAdvertised)(self)
                ? self
                : await this.membership.findRepresentative(actor.agencyId);
        }
        if (input?.contactPhone !== undefined && (!(0, agency_membership_port_1.mayBeAdvertised)(self) || !member)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_CONTACT_MEMBER_INVALID);
        }
        if (!member)
            return { contactMemberId: null, contactName: null, contactPhone: null };
        return {
            contactMemberId: member.id,
            contactName: member.displayName,
            contactPhone: input?.contactPhone ?? member.phone,
        };
    }
    /** Recomputes counters for the listing's complex and all of its participating agencies. */
    async refreshFor(tx, listingId, complexId) {
        const agencies = await tx.listingAgency.findMany({
            where: { listingId },
            select: { agencyId: true },
        });
        await this.counters.refresh(tx, {
            complexIds: [complexId],
            agencyIds: agencies.map((a) => a.agencyId),
        });
    }
    assertEditable(status) {
        if (!shared_1.AGENCY_EDITABLE_STATUSES.includes(status)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_NOT_EDITABLE);
        }
    }
    async assertPublishable(listing, property, primaryAgencyId) {
        const agency = await this.prisma.agency.findUnique({
            where: { id: primaryAgencyId },
            select: PUBLISH_AGENCY_SELECT,
        });
        const issues = (0, shared_1.checkPublishRequirements)((0, listing_state_1.publishCheckInput)(listing, property, agency));
        if (issues.length > 0) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_PUBLISH_REQUIREMENTS, issues);
        }
    }
    /** The service region is one 시군구 (REGION_SGG_CODE); 법정동 codes elsewhere are rejected. */
    sggCodeFor(emdCode) {
        const sgg = this.config.get('REGION_SGG_CODE');
        if (emdCode && !emdCode.startsWith(sgg)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_REGION_NOT_SUPPORTED);
        }
        return sgg;
    }
    /**
     * The map position must lie in the service region: within SERVICE_REGION_RADIUS_M of the
     * 시군구 centroid (regions row; the built-in 순천시 centre when that row is missing) and, when the
     * 법정동 has a centroid, within EMD_MAX_DISTANCE_M of it. Unknown centroids skip that check.
     */
    async assertInServiceRegion(p) {
        const sgg = this.config.get('REGION_SGG_CODE');
        const fallback = sgg === shared_1.DEFAULT_SGG_CODE
            ? (0, geo_1.geoPoint)(shared_1.DEFAULT_MAP_CENTER.lat, shared_1.DEFAULT_MAP_CENTER.lng)
            : client_1.Prisma.sql `NULL::geography`;
        const point = (0, geo_1.geoPoint)(p.lat, p.lng);
        const [row] = await this.prisma.$queryRaw `
      SELECT
        ST_DWithin(${point},
          COALESCE((SELECT r.location FROM regions r WHERE r.code = ${sgg}), ${fallback}),
          ${constants_1.SERVICE_REGION_RADIUS_M}) AS "inSgg",
        (SELECT ST_DWithin(r.location, ${point}, ${constants_1.EMD_MAX_DISTANCE_M})
           FROM regions r WHERE r.code = ${p.emdCode}) AS "nearEmd"`;
        if (row?.inSgg === false || row?.nearEmd === false) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_REGION_NOT_SUPPORTED);
        }
    }
    /** Validates complex/평형 references; returns the complex's 준공년도 (search fallback). */
    async resolveComplex(p) {
        if (!p.complexId) {
            if (p.areaTypeId)
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_COMPLEX_INVALID);
            return null;
        }
        const complex = await this.prisma.complex.findFirst({
            where: { id: p.complexId, deletedAt: null },
            select: { builtYear: true },
        });
        if (!complex)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_COMPLEX_INVALID);
        if (p.areaTypeId) {
            const n = await this.prisma.complexAreaType.count({
                where: { id: p.areaTypeId, complexId: p.complexId },
            });
            if (n === 0)
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.LISTING_COMPLEX_INVALID);
        }
        return complex.builtYear;
    }
};
exports.AgencyListingsService = AgencyListingsService;
exports.AgencyListingsService = AgencyListingsService = __decorate([
    (0, common_1.Injectable)(),
    __param(7, (0, common_1.Inject)(agency_membership_port_1.LISTING_AGENCY_MEMBERSHIP)),
    __param(8, (0, common_1.Inject)(listing_media_port_1.LISTING_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        app_config_service_1.AppConfig,
        listing_mapper_1.ListingMapper,
        listing_summaries_service_1.ListingSummariesService,
        listing_search_repository_1.ListingSearchRepository,
        listing_region_names_service_1.ListingRegionNamesService,
        listing_counters_service_1.ListingCountersService, Object, Object])
], AgencyListingsService);
//# sourceMappingURL=agency-listings.service.js.map