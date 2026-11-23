import {
  type AdminListingDetail,
  type AdminListingListItem,
  type AdminListingListQuery,
  type AdminListingModerationInput,
  ErrorCode,
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
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../deal-requests/notifications/notifications.service';
import { LISTING_MODERATION, type ListingModerationPort } from '../ports/listing-moderation.port';

const listSelect = {
  id: true,
  status: true,
  dealType: true,
  assetType: true,
  title: true,
  complexId: true,
  salePrice: true,
  deposit: true,
  monthlyRent: true,
  hiddenReason: true,
  viewCount: true,
  publishedAt: true,
  closedAt: true,
  createdAt: true,
  updatedAt: true,
  property: { select: { roadAddress: true } },
  primaryAgency: { select: { id: true, name: true, ownerUserId: true } },
  _count: { select: { reports: { where: { status: { in: [...OPEN_REPORT_STATUSES] } } } } },
} satisfies Prisma.ListingSelect;
type ListRow = Prisma.ListingGetPayload<{ select: typeof listSelect }>;

const detailSelect = {
  ...listSelect,
  description: true,
  verifiedAt: true,
  photoCount: true,
  agencies: {
    select: { isPrimary: true, agency: { select: { id: true, name: true } } },
    orderBy: [{ isPrimary: 'desc' }, { joinedAt: 'asc' }],
  },
  reports: {
    select: { id: true, reason: true, status: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  },
} satisfies Prisma.ListingSelect;
type DetailRow = Prisma.ListingGetPayload<{ select: typeof detailSelect }>;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function toListItem(l: ListRow): AdminListingListItem {
  return {
    id: l.id,
    status: l.status,
    dealType: l.dealType,
    assetType: l.assetType,
    title: l.title,
    roadAddress: l.property.roadAddress,
    complexId: l.complexId,
    primaryAgency: { id: l.primaryAgency.id, name: l.primaryAgency.name },
    salePrice: l.salePrice,
    deposit: l.deposit,
    monthlyRent: l.monthlyRent,
    hiddenReason: l.hiddenReason,
    openReportCount: l._count.reports,
    viewCount: l.viewCount,
    publishedAt: iso(l.publishedAt),
    closedAt: iso(l.closedAt),
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

function toDetail(l: DetailRow): AdminListingDetail {
  return {
    ...toListItem(l),
    description: l.description,
    verifiedAt: iso(l.verifiedAt),
    photoCount: l.photoCount,
    agencies: l.agencies.map((a) => ({ ...a.agency, isPrimary: a.isPrimary })),
    recentReports: l.reports.map((r) => ({
      id: r.id,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
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
  ) {}

  async list(q: AdminListingListQuery): Promise<Paginated<AdminListingListItem>> {
    const where: Prisma.ListingWhereInput = {
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.dealType ? { dealType: q.dealType } : {}),
      ...(q.assetType ? { assetType: q.assetType } : {}),
      ...(q.agencyId ? { primaryAgencyId: q.agencyId } : {}),
      ...(q.complexId ? { complexId: q.complexId } : {}),
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
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          ...args,
        }),
      () => this.prisma.listing.count({ where }),
    );
    return { ...page, items: page.items.map(toListItem) };
  }

  async detail(id: string): Promise<AdminListingDetail> {
    return toDetail(await this.load(id));
  }

  async hide(id: string, dto: AdminListingModerationInput): Promise<AdminListingDetail> {
    const before = await this.load(id);
    if (before.status === ListingStatus.HIDDEN) {
      throw AppException.badRequest(ErrorCode.ADMIN_LISTING_INVALID_STATUS);
    }
    RequestContext.setAuditBefore(toDetail(before));
    await this.moderation.hide(id, dto.reason);
    await this.notifyAgency(before, dto.reason);
    return this.detail(id);
  }

  async unhide(id: string): Promise<AdminListingDetail> {
    const before = await this.load(id);
    if (before.status !== ListingStatus.HIDDEN) {
      throw AppException.badRequest(ErrorCode.ADMIN_LISTING_INVALID_STATUS);
    }
    RequestContext.setAuditBefore(toDetail(before));
    await this.moderation.unhide(id);
    return this.detail(id);
  }

  async forceClose(id: string, dto: AdminListingModerationInput): Promise<AdminListingDetail> {
    const before = await this.load(id);
    if (before.status === ListingStatus.CLOSED) {
      throw AppException.badRequest(ErrorCode.ADMIN_LISTING_INVALID_STATUS);
    }
    RequestContext.setAuditBefore(toDetail(before));
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
