import {
  AgencyStatus,
  ErrorCode,
  type AgencySummary,
  type Paginated,
  type PaginationQuery,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception';
import { toPaginated, toSkipTake } from '../../../common/pagination/pagination';
import { PrismaService } from '../../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';
import { ListingRegionNamesService } from '../../listings/services/listing-region-names.service';

/** Row of GET /me/favorites/agencies: the public office card + when it was saved. */
export interface FavoriteAgencyView extends AgencySummary {
  emdName: string | null;
  favoritedAt: string;
}

const DISCLOSABLE = { status: AgencyStatus.APPROVED, deletedAt: null } as const;

const AGENCY_CARD_SELECT = {
  id: true,
  name: true,
  representativeName: true,
  registrationNumber: true,
  phone: true,
  roadAddress: true,
  addressDetail: true,
  emdCode: true,
  lat: true,
  lng: true,
  specialties: true,
  activeListingCount: true,
  logo: { select: { storageKey: true, variants: true, deletedAt: true } },
} as const;

/**
 * 관심 중개사무소 (same semantics as 관심 매물/단지: idempotent PUT/DELETE, scoped by the caller).
 * Only approved, live offices can be saved or listed; rows of offices that later stop being
 * disclosable are kept but hidden.
 */
@Injectable()
export class FavoriteAgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly regionNames: ListingRegionNamesService,
  ) {}

  async add(userId: string, agencyId: string): Promise<void> {
    const exists = await this.prisma.agency.count({ where: { id: agencyId, ...DISCLOSABLE } });
    if (exists === 0) throw AppException.notFound(ErrorCode.AGENCY_NOT_FOUND);
    await this.prisma.favoriteAgency.createMany({
      data: [{ userId, agencyId }],
      skipDuplicates: true,
    });
  }

  async remove(userId: string, agencyId: string): Promise<void> {
    await this.prisma.favoriteAgency.deleteMany({ where: { userId, agencyId } });
  }

  async list(userId: string, q: PaginationQuery): Promise<Paginated<FavoriteAgencyView>> {
    // Visible favourites = rows whose office is still disclosable (no relation: filter by id set).
    const rows = await this.prisma.favoriteAgency.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { agencyId: 'asc' }],
      select: { agencyId: true, createdAt: true },
    });
    if (rows.length === 0) return toPaginated([], 0, q);
    const visible = new Set(
      (
        await this.prisma.agency.findMany({
          where: { id: { in: rows.map((r) => r.agencyId) }, ...DISCLOSABLE },
          select: { id: true },
        })
      ).map((a) => a.id),
    );
    const favorites = rows.filter((r) => visible.has(r.agencyId));
    const { skip, take } = toSkipTake(q);
    const pageRows = favorites.slice(skip, skip + take);
    const agencies = await this.prisma.agency.findMany({
      where: { id: { in: pageRows.map((r) => r.agencyId) } },
      select: AGENCY_CARD_SELECT,
    });
    const names = await this.regionNames.namesOf(agencies.map((a) => a.emdCode));
    const byId = new Map(agencies.map((a) => [a.id, a]));
    const items = pageRows.flatMap((r): FavoriteAgencyView[] => {
      const a = byId.get(r.agencyId);
      if (!a) return [];
      return [
        {
          id: a.id,
          name: a.name,
          representativeName: a.representativeName,
          registrationNumber: a.registrationNumber,
          phone: a.phone,
          roadAddress: a.roadAddress,
          addressDetail: a.addressDetail,
          emdCode: a.emdCode,
          emdName: (a.emdCode && names.get(a.emdCode)) ?? null,
          lat: a.lat,
          lng: a.lng,
          specialties: a.specialties,
          logoUrl: a.logo && !a.logo.deletedAt ? this.media.url(a.logo, 'thumb') : null,
          activeListingCount: a.activeListingCount,
          favoritedAt: r.createdAt.toISOString(),
        },
      ];
    });
    return toPaginated(items, favorites.length, q);
  }
}
