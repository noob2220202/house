import {
  AssetType,
  DEAL_TYPE_LABEL,
  ErrorCode,
  PUBLIC_LISTING_STATUSES,
  sqmToPyeong,
  type DealType,
  type ListingSummary,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { AppException } from '../../../common/errors/app.exception';
import { pyeongLabel } from '../../../common/utils/area';
import { decimalToNumber } from '../../../common/utils/decimal';
import { PrismaService } from '../../../prisma/prisma.service';
import { LISTINGS_SEARCH_CACHE_NS } from '../constants';
import { emdCodesOfRegionKey, regionKeyOf } from '../domain/region-key';
import { LISTING_SUMMARY_SELECT, PUBLIC_PRIMARY_AGENCY_WHERE } from '../listing.selects';
import { ListingRegionNamesService } from './listing-region-names.service';
import { ListingSummariesService } from './listing-summaries.service';

export const SimilarGroupKey = {
  SAME_COMPLEX: 'SAME_COMPLEX',
  SAME_AREA: 'SAME_AREA',
  SAME_PRICE: 'SAME_PRICE',
} as const;
export type SimilarGroupKey = (typeof SimilarGroupKey)[keyof typeof SimilarGroupKey];

export interface SimilarListingGroup {
  key: SimilarGroupKey;
  label: string;
  /** Every match of the group (the cards are the first SIMILAR_GROUP_SIZE). */
  total: number;
  items: ListingSummary[];
}

/** GET /listings/:id/similar (web `similarListingsSchema`). */
export interface SimilarListings {
  /** "연향동 · 매매 · 34평 · 3.2억~4.8억" */
  criteria: string | null;
  regionName: string | null;
  /** Public listings in the listing's 지역 (any type) — "연향동 매물 N개 더 보기". */
  regionListingCount: number | null;
  /** Groups with at least one card, in SAME_COMPLEX → SAME_AREA → SAME_PRICE order. */
  groups: SimilarListingGroup[];
}

export const SIMILAR_GROUP_SIZE = 8;
const SIMILAR_CACHE_TTL_SECONDS = 120;
/** 같은 평형: 전용면적 within ±16㎡ (≈ ±5평); 토지 compares 대지면적 within ±20 %. */
const AREA_TOLERANCE_SQM = 16;
const LAND_AREA_TOLERANCE = 0.2;
/** 같은 가격대: price (매매가 / 분양가+P / 보증금) within ±20 %, at least ±500만원. */
const PRICE_TOLERANCE = 0.2;
const PRICE_TOLERANCE_MIN_MANWON = 500;

const PUBLIC_WHERE = {
  deletedAt: null,
  status: { in: [...PUBLIC_LISTING_STATUSES] },
  ...PUBLIC_PRIMARY_AGENCY_WHERE,
} as const satisfies Prisma.ListingWhereInput;

const ORDER: Prisma.ListingOrderByWithRelationInput[] = [
  { verifiedAt: { sort: 'desc', nulls: 'last' } },
  { publishedAt: { sort: 'desc', nulls: 'last' } },
  { id: 'desc' },
];

/** 만원 → "4.5억" / "9,500만". */
export function formatManwon(v: number): string {
  if (v >= 10_000) {
    const eok = Math.round(v / 1_000) / 10;
    return `${Number.isInteger(eok) ? eok : eok.toFixed(1)}억`;
  }
  return `${Math.round(v).toLocaleString('ko-KR')}만`;
}

/** [lo, hi] price band of 같은 가격대, or null without a price. */
export function priceBand(price: number | null): [number, number] | null {
  if (price === null || price <= 0) return null;
  const tol = Math.max(price * PRICE_TOLERANCE, PRICE_TOLERANCE_MIN_MANWON);
  return [Math.max(0, Math.floor(price - tol)), Math.ceil(price + tol)];
}

interface BaseRow {
  id: string;
  dealType: DealType;
  assetType: AssetType;
  complexId: string | null;
  emdCode: string | null;
  priceSort: number | null;
  exclusiveArea: Prisma.Decimal | null;
  property: { supplyArea: Prisma.Decimal | null; landArea: Prisma.Decimal | null };
}

/** 비슷한 매물 of a public listing: 같은 단지 · 같은 지역 같은 평형 · 같은 가격대. */
@Injectable()
export class SimilarListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly summaries: ListingSummariesService,
    private readonly regionNames: ListingRegionNamesService,
    private readonly cache: CacheService,
  ) {}

  async similar(id: string): Promise<SimilarListings> {
    const base = await this.prisma.listing.findFirst({
      where: { id, ...PUBLIC_WHERE },
      select: {
        id: true,
        dealType: true,
        assetType: true,
        complexId: true,
        emdCode: true,
        priceSort: true,
        exclusiveArea: true,
        property: { select: { supplyArea: true, landArea: true } },
      },
    });
    if (!base) throw AppException.notFound(ErrorCode.LISTING_NOT_FOUND);
    const version = await this.cache.version(LISTINGS_SEARCH_CACHE_NS);
    return this.cache.getOrSet(
      `cache:listings:similar:v${version}:${id}`,
      SIMILAR_CACHE_TTL_SECONDS,
      () => this.compute(base),
    );
  }

  private async compute(base: BaseRow): Promise<SimilarListings> {
    const regionKey = regionKeyOf(base.emdCode);
    const regionCodes = regionKey ? emdCodesOfRegionKey(regionKey) : null;
    const regionName = base.emdCode ? await this.regionNames.nameOf(base.emdCode) : null;
    const land = base.assetType === AssetType.LAND;
    const kind: Prisma.ListingWhereInput = {
      ...PUBLIC_WHERE,
      id: { not: base.id },
      assetType: base.assetType,
    };
    const notSameComplex: Prisma.ListingWhereInput = base.complexId
      ? { OR: [{ complexId: null }, { complexId: { not: base.complexId } }] }
      : {};

    const areaSqm = land
      ? decimalToNumber(base.property.landArea)
      : decimalToNumber(base.exclusiveArea);
    const areaWhere: Prisma.ListingWhereInput | null =
      areaSqm === null || areaSqm <= 0
        ? null
        : land
          ? {
              property: {
                landArea: {
                  gte: areaSqm * (1 - LAND_AREA_TOLERANCE),
                  lte: areaSqm * (1 + LAND_AREA_TOLERANCE),
                },
              },
            }
          : {
              exclusiveArea: {
                gte: Math.max(0, areaSqm - AREA_TOLERANCE_SQM),
                lte: areaSqm + AREA_TOLERANCE_SQM,
              },
            };
    const band = priceBand(base.priceSort);

    const specs: { key: SimilarGroupKey; label: string; where: Prisma.ListingWhereInput }[] = [];
    if (base.complexId) {
      specs.push({
        key: SimilarGroupKey.SAME_COMPLEX,
        label: '같은 단지',
        where: { ...kind, complexId: base.complexId },
      });
    }
    if (areaWhere) {
      specs.push({
        key: SimilarGroupKey.SAME_AREA,
        label: `${regionName ? `${regionName} ` : ''}같은 ${land ? '면적' : '평형'}`,
        where: {
          AND: [
            kind,
            { dealType: base.dealType },
            areaWhere,
            notSameComplex,
            regionCodes ? { emdCode: { in: regionCodes } } : {},
          ],
        },
      });
    }
    if (band) {
      specs.push({
        key: SimilarGroupKey.SAME_PRICE,
        label: '같은 가격대',
        where: {
          AND: [
            kind,
            { dealType: base.dealType },
            { priceSort: { gte: band[0], lte: band[1] } },
            notSameComplex,
          ],
        },
      });
    }

    const [groups, regionListingCount] = await Promise.all([
      Promise.all(specs.map((s) => this.group(s.key, s.label, s.where))),
      regionCodes
        ? this.prisma.listing.count({ where: { ...PUBLIC_WHERE, emdCode: { in: regionCodes } } })
        : Promise.resolve(null),
    ]);

    const supply = decimalToNumber(base.property.supplyArea);
    const areaLabel =
      areaSqm === null || areaSqm <= 0
        ? null
        : land
          ? `${Math.round(sqmToPyeong(areaSqm))}평`
          : pyeongLabel(supply ?? areaSqm);
    const criteria = [
      regionName,
      DEAL_TYPE_LABEL[base.dealType],
      areaLabel,
      band ? `${formatManwon(band[0])}~${formatManwon(band[1])}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      criteria: criteria || null,
      regionName,
      regionListingCount,
      groups: groups.filter((g) => g.items.length > 0),
    };
  }

  private async group(
    key: SimilarGroupKey,
    label: string,
    where: Prisma.ListingWhereInput,
  ): Promise<SimilarListingGroup> {
    const [rows, total] = await Promise.all([
      this.prisma.listing.findMany({
        where,
        orderBy: ORDER,
        take: SIMILAR_GROUP_SIZE,
        select: LISTING_SUMMARY_SELECT,
      }),
      this.prisma.listing.count({ where }),
    ]);
    return { key, label, total, items: await this.summaries.map(rows) };
  }
}
