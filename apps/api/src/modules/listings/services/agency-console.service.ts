import {
  AgencyStatus,
  applicablePrices,
  FloorDisplay,
  ListingAgencyStatus,
  ListingStatus,
  PUBLIC_LISTING_STATUSES,
  type AssetType,
  type DealType,
  type Direction,
  type FloorClass,
  type Paginated,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { UserPrincipal } from '../../../common/auth/principal';
import { paginate } from '../../../common/pagination/pagination';
import { decimalToNumber } from '../../../common/utils/decimal';
import { PrismaService } from '../../../prisma/prisma.service';
import { LISTING_AD_TTL_DAYS } from '../constants';
import { kstDayStart, kstToday } from '../domain/dates';
import type { CoBrokerCandidatesQuery } from '../dto';
import { PUBLIC_PRIMARY_AGENCY_WHERE } from '../listing.selects';
import {
  LISTING_AGENCY_MEMBERSHIP,
  type AgencyMembershipPort,
} from '../ports/agency-membership.port';
import { LISTING_MEDIA, type ListingMediaPort } from '../ports/listing-media.port';

/** GET /agency/listings/summary (web `agencyListingSummarySchema`). */
export interface AgencyListingSummaryView {
  total: number;
  byStatus: Record<ListingStatus, number>;
  /** 광고중/계약중 listings never verified or whose 실매물 확인 runs out within the reminder window. */
  verificationDue: number;
  /** 광고중 listings whose 광고 기간 (expiresAt) ends within the reminder window. */
  expiringSoon: number;
  /** Listings the agency advertises as a co-broker (not the primary). */
  coBrokered: number;
}

/** Row of GET /agency/listings/co-broker-candidates (web `coBrokerCandidateSchema`). */
export interface CoBrokerCandidateView {
  id: string;
  /** No 매물번호 in the model yet. */
  listingNo: null;
  status: ListingStatus;
  dealType: DealType;
  assetType: AssetType;
  name: string;
  dong: string | null;
  salePrice: number | null;
  deposit: number | null;
  monthlyRent: number | null;
  presalePrice: number | null;
  premium: number | null;
  exclusiveArea: number | null;
  supplyArea: number | null;
  /** null when the primary office shows 저/중/고 only (floorClass stays). */
  floor: number | null;
  totalFloors: number | null;
  floorClass: FloorClass | null;
  direction: Direction | null;
  coverPhotoUrl: string | null;
  verifiedAt: string | null;
  publishedAt: string | null;
  agencyCount: number;
  primaryAgencyName: string;
  /** The caller's agency already co-brokers it (ACTIVE). */
  joined: boolean;
}

/** Reminder window of the console chips (frontend VERIFICATION_SOON_DAYS). */
export const CONSOLE_REMINDER_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A 실매물 확인 keeps an ad up for LISTING_AD_TTL_DAYS; it is "due" when that ends within
 * CONSOLE_REMINDER_DAYS (counted in KST days, like the console's D-day badge): verified before
 * the returned instant.
 */
export function verificationDueBefore(now: Date): Date {
  return new Date(
    kstDayStart(kstToday(now)).getTime() -
      (LISTING_AD_TTL_DAYS - CONSOLE_REMINDER_DAYS - 1) * DAY_MS,
  );
}

const CANDIDATE_SELECT = {
  id: true,
  status: true,
  dealType: true,
  assetType: true,
  title: true,
  salePrice: true,
  deposit: true,
  monthlyRent: true,
  presalePrice: true,
  premium: true,
  exclusiveArea: true,
  floorClass: true,
  floorDisplay: true,
  direction: true,
  verifiedAt: true,
  publishedAt: true,
  property: {
    select: {
      roadAddress: true,
      buildingName: true,
      dong: true,
      floor: true,
      totalFloors: true,
      supplyArea: true,
    },
  },
  complex: { select: { name: true } },
  primaryAgency: { select: { name: true } },
  photos: {
    where: { isCover: true },
    take: 1,
    select: { media: { select: { storageKey: true, variants: true } } },
  },
} as const satisfies Prisma.ListingSelect;
type CandidateRow = Prisma.ListingGetPayload<{ select: typeof CANDIDATE_SELECT }>;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const stripSido = (address: string): string =>
  address.replace(/^(전남광주통합특별시|전라남도|전남)\s*/, '');
/** "101동" / "101" → "101" (dong filter compares without the suffix). */
const dongStem = (s: string): string => s.replace(/\s+/g, '').replace(/동$/, '');

/** Broker console reads that are not one listing: status counters and co-brokerage candidates. */
@Injectable()
export class AgencyConsoleService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LISTING_AGENCY_MEMBERSHIP) private readonly membership: AgencyMembershipPort,
    @Inject(LISTING_MEDIA) private readonly media: ListingMediaPort,
  ) {}

  async summary(principal: UserPrincipal, now = new Date()): Promise<AgencyListingSummaryView> {
    const actor = await this.membership.resolveActor(principal);
    const mine: Prisma.ListingWhereInput = {
      deletedAt: null,
      agencies: { some: { agencyId: actor.agencyId, status: ListingAgencyStatus.ACTIVE } },
    };
    const [groups, verificationDue, expiringSoon, coBrokered] = await Promise.all([
      this.prisma.listing.groupBy({ by: ['status'], where: mine, _count: { _all: true } }),
      this.prisma.listing.count({
        where: {
          ...mine,
          status: { in: [...PUBLIC_LISTING_STATUSES] },
          OR: [{ verifiedAt: null }, { verifiedAt: { lt: verificationDueBefore(now) } }],
        },
      }),
      this.prisma.listing.count({
        where: {
          ...mine,
          status: ListingStatus.ACTIVE,
          expiresAt: { gt: now, lte: new Date(now.getTime() + CONSOLE_REMINDER_DAYS * DAY_MS) },
        },
      }),
      this.prisma.listing.count({ where: { ...mine, primaryAgencyId: { not: actor.agencyId } } }),
    ]);
    const byStatus: Record<ListingStatus, number> = {
      DRAFT: 0,
      ACTIVE: 0,
      RESERVED: 0,
      CLOSED: 0,
      HIDDEN: 0,
    };
    for (const g of groups) byStatus[g.status] = g._count._all;
    return {
      total: Object.values(byStatus).reduce((n, c) => n + c, 0),
      byStatus,
      verificationDue,
      expiringSoon,
      coBrokered,
    };
  }

  /**
   * Public listings of OTHER offices in a 단지 that the caller's agency may ask to co-broker
   * (공동중개 신청). Public fields only: never 호, and no exact floor when the primary office
   * advertises 저/중/고.
   */
  async coBrokerCandidates(
    principal: UserPrincipal,
    q: CoBrokerCandidatesQuery,
  ): Promise<Paginated<CoBrokerCandidateView>> {
    const actor = await this.membership.resolveActor(principal);
    const and: Prisma.ListingWhereInput[] = [
      {
        complexId: q.complexId,
        deletedAt: null,
        status: { in: [...PUBLIC_LISTING_STATUSES] },
        primaryAgencyId: { not: actor.agencyId },
        ...PUBLIC_PRIMARY_AGENCY_WHERE,
      },
    ];
    if (q.dong) {
      const stem = dongStem(q.dong);
      and.push({ property: { dong: { in: [stem, `${stem}동`] } } });
    }
    if (q.q) {
      and.push({
        OR: [
          { property: { dong: { contains: q.q, mode: 'insensitive' } } },
          { title: { contains: q.q, mode: 'insensitive' } },
        ],
      });
    }
    const where: Prisma.ListingWhereInput = { AND: and };
    return paginate(
      q,
      async (args) => {
        const rows = await this.prisma.listing.findMany({
          where,
          orderBy: [
            { verifiedAt: { sort: 'desc', nulls: 'last' } },
            { publishedAt: { sort: 'desc', nulls: 'last' } },
            { id: 'desc' },
          ],
          select: CANDIDATE_SELECT,
          ...args,
        });
        const ids = rows.map((r) => r.id);
        const links =
          ids.length === 0
            ? []
            : await this.prisma.listingAgency.findMany({
                where: {
                  listingId: { in: ids },
                  status: ListingAgencyStatus.ACTIVE,
                  agency: { status: AgencyStatus.APPROVED, deletedAt: null },
                },
                select: { listingId: true, agencyId: true },
              });
        const counts = new Map<string, number>();
        const joined = new Set<string>();
        for (const l of links) {
          counts.set(l.listingId, (counts.get(l.listingId) ?? 0) + 1);
          if (l.agencyId === actor.agencyId) joined.add(l.listingId);
        }
        return rows.map((r) => this.candidate(r, counts.get(r.id) ?? 1, joined.has(r.id)));
      },
      () => this.prisma.listing.count({ where }),
    );
  }

  private candidate(r: CandidateRow, agencyCount: number, joined: boolean): CoBrokerCandidateView {
    const prices = applicablePrices(r.dealType, r);
    const cover = r.photos[0];
    return {
      id: r.id,
      listingNo: null,
      status: r.status,
      dealType: r.dealType,
      assetType: r.assetType,
      name: r.complex?.name ?? r.property.buildingName ?? stripSido(r.property.roadAddress),
      dong: r.property.dong,
      salePrice: prices.salePrice ?? null,
      deposit: prices.deposit ?? null,
      monthlyRent: prices.monthlyRent ?? null,
      presalePrice: prices.presalePrice ?? null,
      premium: prices.premium ?? null,
      exclusiveArea: decimalToNumber(r.exclusiveArea),
      supplyArea: decimalToNumber(r.property.supplyArea),
      floor: r.floorDisplay === FloorDisplay.CLASS ? null : r.property.floor,
      totalFloors: r.property.totalFloors,
      floorClass: r.floorClass,
      direction: r.direction,
      coverPhotoUrl: cover ? this.media.urls(cover.media).thumbUrl : null,
      verifiedAt: iso(r.verifiedAt),
      publishedAt: iso(r.publishedAt),
      agencyCount,
      primaryAgencyName: r.primaryAgency.name,
      joined,
    };
  }
}
