import { type ComplexDetail, type ComplexListingsSummary } from '@house/shared';
import { Prisma } from '@prisma/client';
import { type Principal } from '../../../common/auth/principal';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecentViewsService } from '../../listings/services/recent-views.service';
import { type ComplexMediaPort } from '../ports/complex-media.port';
import { ComplexFavoritesService } from './complex-favorites.service';
import { ComplexListingsService } from './complex-listings.service';
import { ComplexPopularityService } from './complex-popularity.service';
import { ComplexTradesService } from './complex-trades.service';
export declare const COMPLEX_DETAIL_SELECT: {
    readonly floorsMin: true;
    readonly floorsMax: true;
    readonly parkingTotal: true;
    readonly parkingPerHousehold: true;
    readonly floorAreaRatio: true;
    readonly buildingCoverageRatio: true;
    readonly heatingType: true;
    readonly builder: true;
    readonly areaTypes: {
        readonly select: {
            readonly id: true;
            readonly exclusiveArea: true;
            readonly supplyArea: true;
            readonly typeName: true;
            readonly pyeongLabel: true;
            readonly households: true;
            readonly rooms: true;
            readonly baths: true;
        };
        readonly orderBy: [{
            readonly exclusiveArea: "asc";
        }, {
            readonly typeName: "asc";
        }];
    };
    readonly photos: {
        readonly where: {
            readonly media: {
                readonly deletedAt: null;
                readonly status: "READY";
            };
        };
        readonly orderBy: [{
            readonly sortOrder: "asc";
        }, {
            readonly createdAt: "asc";
        }];
        readonly select: {
            readonly mediaId: true;
            readonly caption: true;
            readonly sortOrder: true;
            readonly media: {
                readonly select: {
                    readonly storageKey: true;
                    readonly variants: true;
                };
            };
        };
    };
    readonly id: true;
    readonly name: true;
    readonly assetType: true;
    readonly roadAddress: true;
    readonly jibunAddress: true;
    readonly sggCode: true;
    readonly emdCode: true;
    readonly emdName: true;
    readonly lat: true;
    readonly lng: true;
    readonly households: true;
    readonly buildings: true;
    readonly builtYear: true;
    readonly approvalDate: true;
    readonly activeListingCount: true;
    readonly favoriteCount: true;
    readonly viewCount: true;
};
export type ComplexDetailRow = Prisma.ComplexGetPayload<{
    select: typeof COMPLEX_DETAIL_SELECT;
}>;
/** Public 단지 detail (with stats, listing summary, favorite flag) and listing summary. */
export declare class ComplexQueryService {
    private readonly prisma;
    private readonly trades;
    private readonly listings;
    private readonly popularity;
    private readonly favorites;
    private readonly recentViews;
    private readonly media;
    private readonly logger;
    constructor(prisma: PrismaService, trades: ComplexTradesService, listings: ComplexListingsService, popularity: ComplexPopularityService, favorites: ComplexFavoritesService, recentViews: RecentViewsService, media: ComplexMediaPort);
    detail(id: string, principal: Principal | undefined): Promise<ComplexDetail>;
    listingSummary(id: string): Promise<ComplexListingsSummary>;
    /** Fields shared by the public detail and the admin view. */
    base(row: ComplexDetailRow): Omit<ComplexDetail, 'region' | 'latestTrades' | 'listingSummary' | 'isFavorite'>;
}
