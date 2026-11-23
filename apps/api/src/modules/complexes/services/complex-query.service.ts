import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  ErrorCode,
  MediaStatus,
  RecentViewTarget,
  type ComplexDetail,
  type ComplexListingsSummary,
  type ComplexPhotoView,
} from '@house/shared';
import { Prisma } from '@prisma/client';
import { isUserPrincipal, type Principal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { decimalToNumber } from '../../../common/utils/decimal';
import { PrismaService } from '../../../prisma/prisma.service';
import { RecentViewsService } from '../../listings/services/recent-views.service';
import {
  AREA_TYPE_SELECT,
  COMPLEX_SUMMARY_SELECT,
  toAreaTypeView,
  toComplexSummary,
} from '../complex.mapper';
import { COMPLEX_MEDIA, type ComplexMediaPort } from '../ports/complex-media.port';
import { ComplexFavoritesService } from './complex-favorites.service';
import { ComplexListingsService } from './complex-listings.service';
import { ComplexPopularityService } from './complex-popularity.service';
import { ComplexTradesService } from './complex-trades.service';

export const COMPLEX_DETAIL_SELECT = {
  ...COMPLEX_SUMMARY_SELECT,
  floorsMin: true,
  floorsMax: true,
  parkingTotal: true,
  parkingPerHousehold: true,
  floorAreaRatio: true,
  buildingCoverageRatio: true,
  heatingType: true,
  builder: true,
  areaTypes: {
    select: AREA_TYPE_SELECT,
    orderBy: [{ exclusiveArea: 'asc' }, { typeName: 'asc' }],
  },
  photos: {
    where: { media: { deletedAt: null, status: MediaStatus.READY } },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      mediaId: true,
      caption: true,
      sortOrder: true,
      media: { select: { storageKey: true, variants: true } },
    },
  },
} as const satisfies Prisma.ComplexSelect;

export type ComplexDetailRow = Prisma.ComplexGetPayload<{ select: typeof COMPLEX_DETAIL_SELECT }>;

/** Public 단지 detail (with stats, listing summary, favorite flag) and listing summary. */
@Injectable()
export class ComplexQueryService {
  private readonly logger = new Logger(ComplexQueryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trades: ComplexTradesService,
    private readonly listings: ComplexListingsService,
    private readonly popularity: ComplexPopularityService,
    private readonly favorites: ComplexFavoritesService,
    private readonly recentViews: RecentViewsService,
    @Inject(COMPLEX_MEDIA) private readonly media: ComplexMediaPort,
  ) {}

  async detail(id: string, principal: Principal | undefined): Promise<ComplexDetail> {
    const row = await this.prisma.complex.findFirst({
      where: { id, deletedAt: null },
      select: COMPLEX_DETAIL_SELECT,
    });
    if (!row) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);

    const user = isUserPrincipal(principal) ? principal : undefined;
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
    if (user) await this.recentViews.record(user.userId, RecentViewTarget.COMPLEX, id);

    return {
      ...this.base(row),
      viewCount,
      region,
      latestTrades,
      listingSummary,
      isFavorite,
    };
  }

  async listingSummary(id: string): Promise<ComplexListingsSummary> {
    const n = await this.prisma.complex.count({ where: { id, deletedAt: null } });
    if (n === 0) throw AppException.notFound(ErrorCode.COMPLEX_NOT_FOUND);
    return this.listings.summary(id);
  }

  /** Fields shared by the public detail and the admin view. */
  base(
    row: ComplexDetailRow,
  ): Omit<ComplexDetail, 'region' | 'latestTrades' | 'listingSummary' | 'isFavorite'> {
    return {
      ...toComplexSummary(row),
      floorsMin: row.floorsMin,
      floorsMax: row.floorsMax,
      approvalYear: row.approvalDate?.getUTCFullYear() ?? row.builtYear,
      parkingTotal: row.parkingTotal,
      parkingPerHousehold: decimalToNumber(row.parkingPerHousehold),
      floorAreaRatio: decimalToNumber(row.floorAreaRatio),
      buildingCoverageRatio: decimalToNumber(row.buildingCoverageRatio),
      heatingType: row.heatingType,
      builder: row.builder,
      areaTypes: row.areaTypes.map(toAreaTypeView),
      photos: row.photos.map(
        (p): ComplexPhotoView => ({
          mediaId: p.mediaId,
          ...this.media.urls(p.media),
          caption: p.caption,
          sortOrder: p.sortOrder,
        }),
      ),
    };
  }
}
