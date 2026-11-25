import {
  type AdminListingDetail,
  type AdminListingListItem,
  type AdminListingListQuery,
  type AdminListingModerationInput,
  type AdminListingReviewFlag,
  AuditActorType,
  ErrorCode,
  ListingAgencyStatus,
  ListingStatus,
  NotificationType,
  OPEN_REPORT_STATUSES,
  type Paginated,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { RequestContext } from '../../../common/context/request-context';
import { AppException } from '../../../common/errors/app.exception';
import { paginate } from '../../../common/pagination/pagination';
import { decimalToNumber } from '../../../common/utils/decimal';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  regionNameCandidates,
  regionNameOf,
  type RegionNameRow,
} from '../../deal-requests/domain/region-name';
import { MediaService } from '../../media/media.service';
import { NotificationsService } from '../../deal-requests/notifications/notifications.service';
import { LISTING_MODERATION, type ListingModerationPort } from '../ports/listing-moderation.port';

const coverSelect = {
  where: { media: { deletedAt: null } },
  select: { media: { select: { storageKey: true, variants: true } } },
  orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
  take: 1,
} satisfies Prisma.Listing$photosArgs;

const listSelect = {
  id: true,
  status: true,
  dealType: true,
  assetType: true,
  title: true,
  complexId: true,
  emdCode: true,
  salePrice: true,
  deposit: true,
  monthlyRent: true,
  presalePrice: true,
  premium: true,
  exclusiveArea: true,
  floorClass: true,
  photoCount: true,
  verifiedAt: true,
  hiddenReason: true,
  viewCount: true,
  favoriteCount: true,
  publishedAt: true,
  expiresAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  complex: { select: { name: true } },
  property: {
    select: {
      roadAddress: true,
      buildingName: true,
      dong: true,
      supplyArea: true,
      floor: true,
      totalFloors: true,
    },
  },
  primaryAgency: { select: { id: true, name: true, ownerUserId: true } },
  photos: coverSelect,
  _count: {
    select: {
      reports: { where: { status: { in: [...OPEN_REPORT_STATUSES] } } },
      agencies: { where: { status: ListingAgencyStatus.ACTIVE } },
    },
  },
} satisfies Prisma.ListingSelect;
type ListRow = Prisma.ListingGetPayload<{ select: typeof listSelect }>;

const detailSelect = {
  ...listSelect,
  description: true,
  maintenanceFeeWon: true,
  moveInType: true,
  moveInDate: true,
  options: true,
  rooms: true,
  baths: true,
  direction: true,
  property: {
    select: {
      ...listSelect.property.select,
      jibunAddress: true,
      approvalDate: true,
      parkingSpaces: true,
    },
  },
  photos: {
    where: { media: { deletedAt: null } },
    select: {
      id: true,
      isCover: true,
      media: { select: { storageKey: true, variants: true } },
    },
    orderBy: [{ isCover: 'desc' }, { sortOrder: 'asc' }],
    take: 50,
  },
  agencies: {
    select: {
      isPrimary: true,
      status: true,
      contactName: true,
      contactPhone: true,
      joinedAt: true,
      withdrawnAt: true,
      agency: { select: { id: true, name: true } },
    },
    orderBy: [{ isPrimary: 'desc' }, { joinedAt: 'asc' }],
  },
  verifications: {
    select: {
      id: true,
      method: true,
      verifiedAt: true,
      note: true,
      verifiedByAdmin: { select: { name: true } },
      verifiedByUser: { select: { nickname: true, name: true } },
    },
    orderBy: { verifiedAt: 'desc' },
    take: 20,
  },
  reports: {
    select: { id: true, reason: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  },
} satisfies Prisma.ListingSelect;
type DetailRow = Prisma.ListingGetPayload<{ select: typeof detailSelect }>;

/** Admin actions on a listing that appear in its history. */
const LISTING_AUDIT_ACTION: Record<string, string> = {
  'listing.hide': 'LISTING_HIDDEN',
  'listing.unhide': 'LISTING_UNHIDDEN',
  'listing.force-close': 'LISTING_FORCE_CLOSED',
};

interface ListingAuditRow {
  id: string;
  action: string;
  after: Prisma.JsonValue | null;
  createdAt: Date;
  adminUser: { name: string } | null;
}

const LIST_ORDER: Record<AdminListingListQuery['sort'], Prisma.ListingOrderByWithRelationInput[]> =
  {
    LATEST: [{ createdAt: 'desc' }, { id: 'desc' }],
    REPORTS: [{ reports: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
    VIEWS: [{ viewCount: 'desc' }, { id: 'desc' }],
    PRICE_DESC: [{ priceSort: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
  };

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const dateOnly = (d: Date | null): string | null => (d ? d.toISOString().slice(0, 10) : null);
const ADVERTISED: ListingStatus[] = [ListingStatus.ACTIVE, ListingStatus.RESERVED];

function reviewFlags(l: ListRow): AdminListingReviewFlag[] {
  const flags: AdminListingReviewFlag[] = [];
  if (l._count.reports > 0) flags.push('REPORTED');
  if (ADVERTISED.includes(l.status) && l.verifiedAt === null) flags.push('UNVERIFIED');
  return flags;
}

function listingHistory(
  l: DetailRow,
  audits: readonly ListingAuditRow[],
): AdminListingDetail['history'] {
  type Entry = AdminListingDetail['history'][number] & { at: number };
  const out: Entry[] = [];
  const push = (e: Omit<Entry, 'createdAt' | 'at'>, at: Date) =>
    out.push({ ...e, createdAt: at.toISOString(), at: at.getTime() });
  const office = { actorType: AuditActorType.USER, note: null };
  push(
    {
      id: `created:${l.id}`,
      action: 'LISTING_CREATED',
      ...office,
      actorName: l.primaryAgency.name,
    },
    l.createdAt,
  );
  if (l.publishedAt)
    push(
      {
        id: `published:${l.id}`,
        action: 'LISTING_PUBLISHED',
        ...office,
        actorName: l.primaryAgency.name,
      },
      l.publishedAt,
    );
  for (const a of l.agencies) {
    if (a.isPrimary) continue;
    push(
      {
        id: `cobroker:${a.agency.id}`,
        action: 'LISTING_CO_BROKER_JOINED',
        ...office,
        actorName: a.agency.name,
      },
      a.joinedAt,
    );
    if (a.withdrawnAt)
      push(
        {
          id: `cobroker-out:${a.agency.id}`,
          action: 'LISTING_CO_BROKER_WITHDRAWN',
          ...office,
          actorName: a.agency.name,
        },
        a.withdrawnAt,
      );
  }
  for (const v of l.verifications)
    push(
      {
        id: `verified:${v.id}`,
        action: 'LISTING_VERIFIED',
        actorType: v.verifiedByAdmin ? AuditActorType.ADMIN : AuditActorType.USER,
        actorName: v.verifiedByAdmin?.name ?? l.primaryAgency.name,
        note: v.note,
      },
      v.verifiedAt,
    );
  for (const r of l.reports)
    push(
      {
        id: `report:${r.id}`,
        action: 'LISTING_REPORTED',
        actorType: AuditActorType.USER,
        actorName: null,
        note: null,
      },
      r.createdAt,
    );
  let forceClosed = false;
  for (const a of audits) {
    const action = LISTING_AUDIT_ACTION[a.action];
    if (!action) continue;
    if (action === 'LISTING_FORCE_CLOSED') forceClosed = true;
    const after =
      a.after && typeof a.after === 'object' && !Array.isArray(a.after) ? a.after : null;
    const reason = after && typeof after.hiddenReason === 'string' ? after.hiddenReason : null;
    push(
      {
        id: a.id,
        action,
        actorType: AuditActorType.ADMIN,
        actorName: a.adminUser?.name ?? null,
        note: action === 'LISTING_HIDDEN' ? reason : null,
      },
      a.createdAt,
    );
  }
  if (l.closedAt && l.status === ListingStatus.CLOSED && !forceClosed)
    push(
      {
        id: `closed:${l.id}`,
        action: 'LISTING_CLOSED',
        ...office,
        actorName: l.primaryAgency.name,
      },
      l.closedAt,
    );
  return out.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id)).map(({ at: _at, ...e }) => e);
}

/**
 * Back-office listing moderation (all agencies). Reads use the listing tables directly (read-only);
 * state changes go through the listings module (ListingModerationPort) so its counters and map
 * caches stay right. 동·호 (Property.ho) is never selected.
 */
@Injectable()
export class AdminListingsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(LISTING_MODERATION) private readonly moderation: ListingModerationPort,
    private readonly notifications: NotificationsService,
    private readonly media: MediaService,
  ) {}

  private toListItem(l: ListRow, names: ReadonlyMap<string, string>): AdminListingListItem {
    const cover = l.photos[0]?.media;
    return {
      id: l.id,
      status: l.status,
      dealType: l.dealType,
      assetType: l.assetType,
      title: l.title,
      roadAddress: l.property.roadAddress,
      complexId: l.complexId,
      complexName: l.complex?.name ?? null,
      buildingName: l.property.buildingName,
      dong: l.property.dong,
      emdName: l.emdCode ? (names.get(l.emdCode) ?? null) : null,
      supplyArea: decimalToNumber(l.property.supplyArea),
      exclusiveArea: decimalToNumber(l.exclusiveArea),
      floorClass: l.floorClass,
      floor: l.property.floor,
      totalFloors: l.property.totalFloors,
      primaryAgency: { id: l.primaryAgency.id, name: l.primaryAgency.name },
      agencyCount: Math.max(1, l._count.agencies),
      salePrice: l.salePrice,
      deposit: l.deposit,
      monthlyRent: l.monthlyRent,
      presalePrice: l.presalePrice,
      premium: l.premium,
      photoCount: l.photoCount,
      coverUrl: cover ? this.media.url(cover, 'thumb') : null,
      verifiedAt: iso(l.verifiedAt),
      hiddenReason: l.hiddenReason,
      openReportCount: l._count.reports,
      viewCount: l.viewCount,
      favoriteCount: l.favoriteCount,
      reviewFlags: reviewFlags(l),
      publishedAt: iso(l.publishedAt),
      expiresAt: iso(l.expiresAt),
      closedAt: iso(l.closedAt),
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
    };
  }

  private toDetail(
    l: DetailRow,
    names: ReadonlyMap<string, string>,
    audits: readonly ListingAuditRow[],
  ): AdminListingDetail {
    return {
      ...this.toListItem({ ...l, photos: l.photos.slice(0, 1) }, names),
      description: l.description,
      jibunAddress: l.property.jibunAddress,
      rooms: l.rooms,
      baths: l.baths,
      direction: l.direction,
      approvalDate: dateOnly(l.property.approvalDate),
      parkingSpaces: l.property.parkingSpaces,
      maintenanceFeeWon: l.maintenanceFeeWon,
      moveInType: l.moveInType,
      moveInDate: dateOnly(l.moveInDate),
      options: l.options,
      photos: l.photos.map((p) => ({
        id: p.id,
        url: this.media.url(p.media, 'large'),
        isCover: p.isCover,
      })),
      agencies: l.agencies.map((a) => ({
        id: a.agency.id,
        name: a.agency.name,
        isPrimary: a.isPrimary,
        status: a.status,
        contactName: a.contactName,
        phone: a.contactPhone,
        joinedAt: a.joinedAt.toISOString(),
      })),
      verifications: l.verifications.map((v) => ({
        id: v.id,
        method: v.method,
        verifiedAt: v.verifiedAt.toISOString(),
        byName:
          v.verifiedByAdmin?.name ?? v.verifiedByUser?.nickname ?? v.verifiedByUser?.name ?? null,
        note: v.note,
      })),
      recentReports: l.reports.map((r) => ({
        id: r.id,
        reason: r.reason,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
      history: listingHistory(l, audits),
    };
  }

  /** 법정동 names for the given codes (one query). */
  private async emdNames(codes: readonly (string | null)[]): Promise<Map<string, string>> {
    const wanted = [...new Set(codes.filter((c): c is string => !!c && c.length >= 8))];
    if (wanted.length === 0) return new Map();
    const rows: RegionNameRow[] = await this.prisma.region.findMany({
      where: { code: { in: [...new Set(wanted.flatMap(regionNameCandidates))] } },
      select: { code: true, name: true, level: true, parent: { select: { name: true } } },
    });
    const byCode = new Map(rows.map((r) => [r.code, r]));
    const out = new Map<string, string>();
    for (const code of wanted) {
      const name = regionNameOf(code, byCode);
      if (name) out.set(code, name);
    }
    return out;
  }

  async list(q: AdminListingListQuery): Promise<Paginated<AdminListingListItem>> {
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.dealType ? { dealType: q.dealType } : {}),
      ...(q.assetType ? { assetType: q.assetType } : {}),
      ...(q.agencyId ? { primaryAgencyId: q.agencyId } : {}),
      ...(q.complexId ? { complexId: q.complexId } : {}),
      ...(q.needsReview
        ? {
            AND: [
              {
                OR: [
                  { reports: { some: { status: { in: [...OPEN_REPORT_STATUSES] } } } },
                  { status: { in: ADVERTISED }, verifiedAt: null },
                ],
              },
            ],
          }
        : {}),
      ...(q.q
        ? {
            OR: [
              { title: { contains: q.q, mode: 'insensitive' } },
              { property: { roadAddress: { contains: q.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const page = await paginate(
      q,
      (args) =>
        this.prisma.listing.findMany({
          where,
          select: listSelect,
          orderBy: LIST_ORDER[q.sort],
          ...args,
        }),
      () => this.prisma.listing.count({ where }),
    );
    const names = await this.emdNames(page.items.map((l) => l.emdCode));
    return { ...page, items: page.items.map((l) => this.toListItem(l, names)) };
  }

  async detail(id: string): Promise<AdminListingDetail> {
    const row = await this.load(id);
    const [names, audits] = await Promise.all([
      this.emdNames([row.emdCode]),
      this.prisma.auditLog.findMany({
        where: {
          resourceType: 'Listing',
          resourceId: id,
          action: { in: Object.keys(LISTING_AUDIT_ACTION) },
        },
        select: {
          id: true,
          action: true,
          after: true,
          createdAt: true,
          adminUser: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return this.toDetail(row, names, audits);
  }

  /** The audit `before` snapshot: the detail without names / history (no extra queries). */
  private auditSnapshot(row: DetailRow): AdminListingDetail {
    return this.toDetail(row, new Map(), []);
  }

  async hide(id: string, dto: AdminListingModerationInput): Promise<AdminListingDetail> {
    const before = await this.load(id);
    if (before.status === ListingStatus.HIDDEN) {
      throw AppException.badRequest(ErrorCode.ADMIN_LISTING_INVALID_STATUS);
    }
    RequestContext.setAuditBefore(this.auditSnapshot(before));
    await this.moderation.hide(id, dto.reason);
    await this.notifyAgency(before, dto.reason);
    return this.detail(id);
  }

  async unhide(id: string): Promise<AdminListingDetail> {
    const before = await this.load(id);
    if (before.status !== ListingStatus.HIDDEN) {
      throw AppException.badRequest(ErrorCode.ADMIN_LISTING_INVALID_STATUS);
    }
    RequestContext.setAuditBefore(this.auditSnapshot(before));
    await this.moderation.unhide(id);
    return this.detail(id);
  }

  async forceClose(id: string, dto: AdminListingModerationInput): Promise<AdminListingDetail> {
    const before = await this.load(id);
    if (before.status === ListingStatus.CLOSED) {
      throw AppException.badRequest(ErrorCode.ADMIN_LISTING_INVALID_STATUS);
    }
    RequestContext.setAuditBefore(this.auditSnapshot(before));
    await this.moderation.forceClose(id, dto.reason);
    return this.detail(id);
  }

  private async notifyAgency(listing: ListRow, reason: string): Promise<void> {
    const rows = await this.notifications.createFor([listing.primaryAgency.ownerUserId], {
      type: NotificationType.LISTING_HIDDEN,
      title: '매물이 숨김 처리되었습니다.',
      body: reason.slice(0, 1000),
      data: { listingId: listing.id },
    });
    await this.notifications.dispatch(rows);
  }

  private async load(id: string): Promise<DetailRow> {
    const row = await this.prisma.listing.findFirst({
      where: { id, deletedAt: null },
      select: detailSelect,
    });
    if (!row) throw AppException.notFound(ErrorCode.ADMIN_LISTING_NOT_FOUND);
    return row;
  }
}
