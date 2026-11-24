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
var PiiScrubService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PiiScrubService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const prisma_service_1 = require("../../../prisma/prisma.service");
const home_user_data_service_1 = require("../../home/services/home-user-data.service");
const listings_moderation_service_1 = require("../../listings/services/listings-moderation.service");
const media_service_1 = require("../../media/media.service");
const withdrawn_identity_service_1 = require("../users/withdrawn-identity.service");
const BATCH_SIZE = 200;
/** displayName is NOT NULL on agency_members; what a scrubbed former staff member shows as. */
const WITHDRAWN_MEMBER_NAME = '탈퇴 회원';
/**
 * Scrubs personal data of withdrawn members once their grace period (piiScrubAfter) has passed:
 * profile fields, identities, consent ip/UA, phone + ip on their reports, their notifications,
 * recent views and favorites (매물, 단지), 관심 중개사무소 + 관심 지역 (HomeUserDataService.purge:
 * those tables have no FK to users), and the name / title / phone / license number on their former
 * agency staff rows (and any listing contact still pointing at those); uploaded file names are
 * forgotten and unattached uploads deleted (MediaService.scrubOwner). Also drops expired
 * rejoin-cooldown tombstones.
 * Idempotent: only rows not yet scrubbed are touched, so re-running (or a retry) is harmless.
 * The User row itself stays (FKs from listings, reports, audit) as an anonymous tombstone.
 * Deal requests are erased at withdrawal time (AccountService.withdraw → DealRequestMaintenance).
 */
let PiiScrubService = PiiScrubService_1 = class PiiScrubService {
    constructor(prisma, withdrawn, media, listings, homeData) {
        this.prisma = prisma;
        this.withdrawn = withdrawn;
        this.media = media;
        this.listings = listings;
        this.homeData = homeData;
        this.logger = new common_1.Logger(PiiScrubService_1.name);
    }
    async scrubDue(now = new Date()) {
        let total = 0;
        let listingContactsCleared = 0;
        for (;;) {
            const batch = await this.prisma.user.findMany({
                where: { status: shared_1.UserStatus.WITHDRAWN, piiScrubbedAt: null, piiScrubAfter: { lte: now } },
                select: { id: true },
                orderBy: { piiScrubAfter: 'asc' },
                take: BATCH_SIZE,
            });
            if (batch.length === 0)
                break;
            const ids = batch.map((u) => u.id);
            await this.prisma.$transaction(async (tx) => {
                await tx.identity.deleteMany({ where: { userId: { in: ids } } });
                await tx.userConsent.updateMany({
                    where: { userId: { in: ids } },
                    data: { ip: null, userAgent: null },
                });
                await tx.report.updateMany({
                    where: { reporterUserId: { in: ids } },
                    data: { reporterPhone: null, ip: null },
                });
                await tx.notification.deleteMany({ where: { userId: { in: ids } } });
                await tx.recentView.deleteMany({ where: { userId: { in: ids } } });
                await tx.favoriteListing.deleteMany({ where: { userId: { in: ids } } });
                await tx.favoriteComplex.deleteMany({ where: { userId: { in: ids } } });
                await this.homeData.purge(ids, tx);
                for (const id of ids)
                    await this.media.scrubOwner(id, tx, now);
                // Former agency staff rows (kept REMOVED for the office's history) lose who they were.
                const members = await tx.agencyMember.findMany({
                    where: { userId: { in: ids } },
                    select: { id: true },
                });
                if (members.length > 0) {
                    const memberIds = members.map((m) => m.id);
                    await tx.agencyMember.updateMany({
                        where: { id: { in: memberIds } },
                        data: {
                            displayName: WITHDRAWN_MEMBER_NAME,
                            title: null,
                            phone: null,
                            licenseNumber: null,
                        },
                    });
                    // Guard: withdrawal already moved these contacts to the office's 대표 (memberDeparted).
                    const { count } = await tx.listingAgency.updateMany({
                        where: { contactMemberId: { in: memberIds } },
                        data: { contactMemberId: null, contactName: null, contactPhone: null },
                    });
                    listingContactsCleared += count;
                }
                await tx.user.updateMany({
                    where: { id: { in: ids }, piiScrubbedAt: null },
                    data: {
                        email: null,
                        name: null,
                        nickname: null,
                        phone: null,
                        profileImageUrl: null,
                        withdrawalReason: null,
                        suspendedReason: null,
                        piiScrubbedAt: now,
                    },
                });
            }, { timeout: 60_000 });
            total += ids.length;
            if (batch.length < BATCH_SIZE)
                break;
        }
        if (listingContactsCleared > 0)
            await this.listings.invalidateSearch();
        if (total > 0)
            this.logger.log({ count: total }, 'scrubbed PII of withdrawn members');
        const purged = await this.withdrawn.purgeExpired(now);
        if (purged > 0)
            this.logger.log({ count: purged }, 'purged expired rejoin-cooldown tombstones');
        return total;
    }
};
exports.PiiScrubService = PiiScrubService;
exports.PiiScrubService = PiiScrubService = PiiScrubService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        withdrawn_identity_service_1.WithdrawnIdentityService,
        media_service_1.MediaService,
        listings_moderation_service_1.ListingsModerationService,
        home_user_data_service_1.HomeUserDataService])
], PiiScrubService);
//# sourceMappingURL=pii-scrub.service.js.map