import {
  AgencyStatus,
  ListingAgencyStatus,
  ListingStatus,
  type AgencyListingCard,
  type AgencyListingCounts,
  type AssetType,
  type DealType,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import { decimalToNumber } from '../../../common/utils/decimal';
import { PrismaService } from '../../../prisma/prisma.service';
import { AGENCY_MEDIA, type AgencyMediaPort } from './agency-media.port';

/**
 * Read-only view of an agency's listings for its public profile. The listings module owns those
 * tables and exposes no reader yet, so this binding queries them read-only; swap it for a
 * ListingsModule service once one exists.
 */
export interface AgencyListingsReader {
  counts(agencyId: string): Promise<AgencyListingCounts>;
  representative(agencyId: string, limit: number): Promise<AgencyListingCard[]>;
}

export const AGENCY_LISTINGS_READER = Symbol('AGENCY_LISTINGS_READER');

interface CountRow {
  assetType: AssetType;
  dealType: DealType;
  count: number;
}

@Injectable()
export class PrismaAgencyListingsReader implements AgencyListingsReader {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AGENCY_MEDIA) private readonly media: AgencyMediaPort,
  ) {}

  /**
   * Advertised (ACTIVE) listings the agency is an active (co-)broker of, by type. A listing whose
   * primary agency is suspended is not advertised, even through its co-brokers.
   */
  async counts(agencyId: string): Promise<AgencyListingCounts> {
    const rows = await this.prisma.$queryRaw<CountRow[]>`
      SELECT l.asset_type::text AS "assetType", l.deal_type::text AS "dealType", count(*)::int AS count
      FROM listing_agencies la
      JOIN listings l ON l.id = la.listing_id
      WHERE la.agency_id = ${agencyId}::uuid
        AND la.status = ${ListingAgencyStatus.ACTIVE}::listing_agency_status
        AND l.status = ${ListingStatus.ACTIVE}::listing_status
        AND l.deleted_at IS NULL
        AND EXISTS (SELECT 1 FROM agencies pa WHERE pa.id = l.primary_agency_id
          AND pa.status = ${AgencyStatus.APPROVED}::agency_status AND pa.deleted_at IS NULL)
      GROUP BY l.asset_type, l.deal_type`;
    const out: AgencyListingCounts = { total: 0, byAssetType: {}, byDealType: {} };
    for (const r of rows) {
      out.total += r.count;
      out.byAssetType[r.assetType] = (out.byAssetType[r.assetType] ?? 0) + r.count;
      out.byDealType[r.dealType] = (out.byDealType[r.dealType] ?? 0) + r.count;
    }
    return out;
  }

  /** 대표 매물: most recently 실매물-verified, then newest. No 동/호 or address detail. */
  async representative(agencyId: string, limit: number): Promise<AgencyListingCard[]> {
    const rows = await this.prisma.listing.findMany({
      where: {
        status: ListingStatus.ACTIVE,
        deletedAt: null,
        agencies: { some: { agencyId, status: ListingAgencyStatus.ACTIVE } },
        // Same visibility rule as public listing search: the primary agency must be approved.
        primaryAgency: { status: AgencyStatus.APPROVED, deletedAt: null },
      },
      orderBy: [
        { verifiedAt: { sort: 'desc', nulls: 'last' } },
        { publishedAt: { sort: 'desc', nulls: 'last' } },
        { id: 'desc' },
      ],
      take: limit,
      select: {
        id: true,
        assetType: true,
        dealType: true,
        title: true,
        salePrice: true,
        deposit: true,
        monthlyRent: true,
        presalePrice: true,
        premium: true,
        exclusiveArea: true,
        rooms: true,
        verifiedAt: true,
        publishedAt: true,
        complex: { select: { name: true } },
        photos: {
          where: { media: { deletedAt: null } },
          orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
          take: 1,
          select: { media: { select: { storageKey: true, variants: true } } },
        },
      },
    });
    return rows.map((l) => {
      const cover = l.photos[0]?.media;
      return {
        id: l.id,
        assetType: l.assetType,
        dealType: l.dealType,
        title: l.title,
        complexName: l.complex?.name ?? null,
        salePrice: l.salePrice,
        deposit: l.deposit,
        monthlyRent: l.monthlyRent,
        presalePrice: l.presalePrice,
        premium: l.premium,
        exclusiveArea: decimalToNumber(l.exclusiveArea),
        rooms: l.rooms,
        thumbnailUrl: cover ? this.media.publicUrl(cover, 'thumb') : null,
        verifiedAt: l.verifiedAt?.toISOString() ?? null,
        publishedAt: l.publishedAt?.toISOString() ?? null,
      };
    });
  }
}
