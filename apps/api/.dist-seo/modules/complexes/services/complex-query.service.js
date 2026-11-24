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
var ComplexQueryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ComplexQueryService = exports.COMPLEX_DETAIL_SELECT = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const principal_1 = require("../../../common/auth/principal");
const app_exception_1 = require("../../../common/errors/app.exception");
const decimal_1 = require("../../../common/utils/decimal");
const prisma_service_1 = require("../../../prisma/prisma.service");
const recent_views_service_1 = require("../../listings/services/recent-views.service");
const complex_mapper_1 = require("../complex.mapper");
const complex_media_port_1 = require("../ports/complex-media.port");
const complex_favorites_service_1 = require("./complex-favorites.service");
const complex_listings_service_1 = require("./complex-listings.service");
const complex_popularity_service_1 = require("./complex-popularity.service");
const complex_trades_service_1 = require("./complex-trades.service");
exports.COMPLEX_DETAIL_SELECT = {
    ...complex_mapper_1.COMPLEX_SUMMARY_SELECT,
    floorsMin: true,
    floorsMax: true,
    parkingTotal: true,
    parkingPerHousehold: true,
    floorAreaRatio: true,
    buildingCoverageRatio: true,
    heatingType: true,
    builder: true,
    areaTypes: {
        select: complex_mapper_1.AREA_TYPE_SELECT,
        orderBy: [{ exclusiveArea: 'asc' }, { typeName: 'asc' }],
    },
    photos: {
        where: { media: { deletedAt: null, status: shared_1.MediaStatus.READY } },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
            mediaId: true,
            caption: true,
            sortOrder: true,
            media: { select: { storageKey: true, variants: true } },
        },
    },
};
/** Public 단지 detail (with stats, listing summary, favorite flag) and listing summary. */
let ComplexQueryService = ComplexQueryService_1 = class ComplexQueryService {
    constructor(prisma, trades, listings, popularity, favorites, recentViews, media) {
        this.prisma = prisma;
        this.trades = trades;
        this.listings = listings;
        this.popularity = popularity;
        this.favorites = favorites;
        this.recentViews = recentViews;
        this.media = media;
        this.logger = new common_1.Logger(ComplexQueryService_1.name);
    }
    async detail(id, principal) {
        const row = await this.prisma.complex.findFirst({
            where: { id, deletedAt: null },
            select: exports.COMPLEX_DETAIL_SELECT,
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_NOT_FOUND);
        const user = (0, principal_1.isUserPrincipal)(principal) ? principal : undefined;
        const [region, latestTrades, listingSummary, isFavorite, viewCount] = await Promise.all([
            row.emdCode
                ? this.prisma.region.findUnique({
                    where: { code: row.emdCode },
                    select: { code: true, name: true, fullName: true },
                })
                : Promise.resolve(null),
            this.trades.latestTrades(id),
            this.listings.summary(id),
            user ? this.favorites.isFavorite(user.userId, id) : Promise.resolve(false),
            this.popularity.recordView(id, this.popularity.viewerKey(principal), row.viewCount),
        ]);
        if (user)
            await this.recentViews.record(user.userId, shared_1.RecentViewTarget.COMPLEX, id);
        return {
            ...this.base(row),
            viewCount,
            region,
            latestTrades,
            listingSummary,
            isFavorite,
        };
    }
    async listingSummary(id) {
        const n = await this.prisma.complex.count({ where: { id, deletedAt: null } });
        if (n === 0)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_NOT_FOUND);
        return this.listings.summary(id);
    }
    /** Fields shared by the public detail and the admin view. */
    base(row) {
        return {
            ...(0, complex_mapper_1.toComplexSummary)(row),
            floorsMin: row.floorsMin,
            floorsMax: row.floorsMax,
            approvalYear: row.approvalDate?.getUTCFullYear() ?? row.builtYear,
            parkingTotal: row.parkingTotal,
            parkingPerHousehold: (0, decimal_1.decimalToNumber)(row.parkingPerHousehold),
            floorAreaRatio: (0, decimal_1.decimalToNumber)(row.floorAreaRatio),
            buildingCoverageRatio: (0, decimal_1.decimalToNumber)(row.buildingCoverageRatio),
            heatingType: row.heatingType,
            builder: row.builder,
            areaTypes: row.areaTypes.map(complex_mapper_1.toAreaTypeView),
            photos: row.photos.map((p) => ({
                mediaId: p.mediaId,
                ...this.media.urls(p.media),
                caption: p.caption,
                sortOrder: p.sortOrder,
            })),
        };
    }
};
exports.ComplexQueryService = ComplexQueryService;
exports.ComplexQueryService = ComplexQueryService = ComplexQueryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Inject)(complex_media_port_1.COMPLEX_MEDIA)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        complex_trades_service_1.ComplexTradesService,
        complex_listings_service_1.ComplexListingsService,
        complex_popularity_service_1.ComplexPopularityService,
        complex_favorites_service_1.ComplexFavoritesService,
        recent_views_service_1.RecentViewsService, Object])
], ComplexQueryService);
//# sourceMappingURL=complex-query.service.js.map