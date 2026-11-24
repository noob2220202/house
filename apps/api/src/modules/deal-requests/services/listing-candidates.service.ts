import {
  DealType,
  ErrorCode,
  ListingAgencyStatus,
  ListingStatus,
  floorLabel,
  type AssetType,
  type Paginated,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { toPaginated, toSkipTake } from '../../../common/pagination/pagination';
import { decimalToNumber } from '../../../common/utils/decimal';
import { PrismaService } from '../../../prisma/prisma.service';
import { rankByMatch, type MatchRequest } from '../domain/listing-match';
import type { ListingCandidateQuery } from '../dto';
import { DEAL_REQUEST_MEDIA, type DealRequestMediaPort } from '../ports/media.port';
import { AgencyActorService } from './agency-actor.service';
import { agencyVisibleWhere } from './deal-request-access';
import { RegionNamesService } from './region-names.service';

/** A listing of the caller's agency in the proposal picker (web `inboxListingSchema`, 만원 / ㎡). */
export interface ListingCandidateView {
  id: string;
  title: string;
  assetType: AssetType;
  dealType: DealType;
  /** 매매가 / 전세 보증금 / 분양권 매매가 (분양가 + 프리미엄). */
  price: number | null;
  /** 월세 보증금. */
  deposit: number | null;
  monthlyRent: number | null;
  exclusiveArea: number | null;
  floorLabel: string | null;
  rooms: number | null;
  emdCode: string | null;
  emdName: string | null;
  complexId: string | null;
  thumbUrl: string | null;
  verifiedAt: string | null;
}

/** Ranking happens in memory: an office has a few hundred active listings at most. */
const CANDIDATE_SCAN_LIMIT = 500;

const candidateSelect = {
  id: true,
  title: true,
  assetType: true,
  dealType: true,
  salePrice: true,
  deposit: true,
  monthlyRent: true,
  presalePrice: true,
  premium: true,
  exclusiveArea: true,
  rooms: true,
  emdCode: true,
  complexId: true,
  verifiedAt: true,
  complex: { select: { name: true } },
  property: { select: { floor: true, totalFloors: true } },
  photos: {
    where: { media: { deletedAt: null } },
    orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
    take: 1,
    select: { media: { select: { storageKey: true, variants: true } } },
  },
} satisfies Prisma.ListingSelect;
type CandidateRow = Prisma.ListingGetPayload<{ select: typeof candidateSelect }>;

/**
 * GET /agency/deal-requests/:id/listing-candidates — the agency's ACTIVE listings that may be
 * attached to a proposal for a request it can see (the proposal rule: ACTIVE + actively
 * (co-)brokered), best match for the request first. Reads the listing tables read-only.
 */
@Injectable()
export class ListingCandidatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actors: AgencyActorService,
    private readonly regionNames: RegionNamesService,
    @Inject(DEAL_REQUEST_MEDIA) private readonly media: DealRequestMediaPort,
  ) {}

  async list(
    user: UserPrincipal,
    id: string,
    q: ListingCandidateQuery,
    now: Date = new Date(),
  ): Promise<Paginated<ListingCandidateView>> {
    const actor = await this.actors.resolve(user);
    const request = await this.prisma.dealRequest.findFirst({
      where: { AND: [agencyVisibleWhere(actor, now), { id }] },
      select: {
        type: true,
        assetType: true,
        dealTypes: true,
        emdCode: true,
        complexId: true,
        regionCodes: true,
        complexIds: true,
        priceMin: true,
        priceMax: true,
        depositMin: true,
        depositMax: true,
        rentMin: true,
        rentMax: true,
        areaMin: true,
        areaMax: true,
        roomsMin: true,
      },
    });
    if (!request) throw AppException.notFound(ErrorCode.DEAL_REQUEST_NOT_FOUND);
    const match: MatchRequest = {
      ...request,
      areaMin: decimalToNumber(request.areaMin),
      areaMax: decimalToNumber(request.areaMax),
    };

    const rows = await this.prisma.listing.findMany({
      where: {
        deletedAt: null,
        status: ListingStatus.ACTIVE,
        agencies: { some: { agencyId: actor.agencyId, status: ListingAgencyStatus.ACTIVE } },
        ...(q.q
          ? {
              OR: [
                { title: { contains: q.q, mode: 'insensitive' } },
                { complex: { name: { contains: q.q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      orderBy: [{ verifiedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      take: CANDIDATE_SCAN_LIMIT,
      select: candidateSelect,
    });
    const names = await this.regionNames.namesOf(rows.map((r) => r.emdCode));
    const ranked = rankByMatch(
      match,
      rows.map((r) => this.toView(r, names)),
    );
    const { skip, take } = toSkipTake(q);
    return toPaginated(ranked.slice(skip, skip + take), ranked.length, q);
  }

  private toView(r: CandidateRow, names: ReadonlyMap<string, string>): ListingCandidateView {
    const cover = r.photos[0]?.media;
    const monthly = r.dealType === DealType.MONTHLY;
    const price =
      r.dealType === DealType.SALE
        ? r.salePrice
        : r.dealType === DealType.PRESALE
          ? r.presalePrice === null
            ? null
            : r.presalePrice + (r.premium ?? 0)
          : r.dealType === DealType.JEONSE
            ? r.deposit
            : null;
    return {
      id: r.id,
      title: r.title ?? r.complex?.name ?? '제목 없는 매물',
      assetType: r.assetType,
      dealType: r.dealType,
      price,
      deposit: monthly ? r.deposit : null,
      monthlyRent: monthly ? r.monthlyRent : null,
      exclusiveArea: decimalToNumber(r.exclusiveArea),
      // The agency's own listing: the exact floor is fine here.
      floorLabel: floorLabel(r.property.floor, r.property.totalFloors),
      rooms: r.rooms,
      emdCode: r.emdCode,
      emdName: r.emdCode ? (names.get(r.emdCode) ?? null) : null,
      complexId: r.complexId,
      thumbUrl: cover ? this.media.publicUrl(cover, 'thumb') : null,
      verifiedAt: r.verifiedAt?.toISOString() ?? null,
    };
  }
}
