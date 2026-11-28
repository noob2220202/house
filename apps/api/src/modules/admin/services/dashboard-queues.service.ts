import {
  ADS_ENDING_SOON_DAYS,
  AgencySiteStatus,
  AgencyStatus,
  DealRequestStatus,
  DealRequestType,
  DealType,
  OPEN_REPORT_STATUSES,
  ProposalStatus,
  ReportStatus,
  ReportTargetType,
} from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { CacheService } from '../../../common/cache/cache.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { MediaService } from '../../media/media.service';
import { DASHBOARD_CACHE_TTL_SECONDS } from '../constants';
import type {
  DashboardDealRequest,
  DashboardExpiringAd,
  DashboardPendingAgency,
  DashboardPendingAgencySite,
  DashboardQueues,
  DashboardReport,
} from '../schemas';
import {
  documentChecklist,
  listingHeadline,
  priceFields,
  pyeongLabel,
  regionNames,
} from './admin-format';
import { startOfKstDay } from './dashboard.service';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
/** Rows previewed per dashboard panel. */
export const QUEUE_PREVIEW = 5;
const ACTIVE_PROPOSAL_STATUSES = [
  ProposalStatus.SENT,
  ProposalStatus.VIEWED,
  ProposalStatus.ACCEPTED,
];
const OPEN_DEAL_REQUEST_STATUSES = [DealRequestStatus.OPEN, DealRequestStatus.MATCHED];

/** 00:00 KST of the Monday of the week containing `now`. */
export function startOfKstWeek(now: Date): Date {
  const day = startOfKstDay(now);
  const kstDow = new Date(day.getTime() + 9 * HOUR_MS).getUTCDay(); // 0 = Sunday
  const sinceMonday = (kstDow + 6) % 7;
  return new Date(day.getTime() - sinceMonday * DAY_MS);
}

/** Average report handling time in hours (one decimal), null when nothing was handled. */
export function averageHandleHours(
  rows: { createdAt: Date; handledAt: Date | null }[],
): number | null {
  const spans = rows
    .filter((r): r is { createdAt: Date; handledAt: Date } => r.handledAt !== null)
    .map((r) => Math.max(0, r.handledAt.getTime() - r.createdAt.getTime()));
  if (spans.length === 0) return null;
  const avg = spans.reduce((a, b) => a + b, 0) / spans.length / HOUR_MS;
  return Math.round(avg * 10) / 10;
}

/** Click-through rate 0–1 (4 decimals), null without impressions. */
export function ctrOf(impressions: number, clicks: number): number | null {
  if (impressions <= 0) return null;
  return Math.min(1, Math.round((clicks / impressions) * 10_000) / 10_000);
}

const dealRequestSelect = {
  id: true,
  type: true,
  dealTypes: true,
  emdCode: true,
  regionCodes: true,
  complexIds: true,
  exclusiveArea: true,
  areaMin: true,
  areaMax: true,
  floor: true,
  moveInDate: true,
  desiredSalePrice: true,
  desiredDeposit: true,
  desiredMonthlyRent: true,
  priceMax: true,
  depositMax: true,
  rentMax: true,
  createdAt: true,
  complex: { select: { name: true } },
  _count: {
    select: {
      targets: true,
      proposals: { where: { status: { in: ACTIVE_PROPOSAL_STATUSES } } },
    },
  },
} satisfies Prisma.DealRequestSelect;
type DealRequestRow = Prisma.DealRequestGetPayload<{ select: typeof dealRequestSelect }>;

/**
 * GET /admin/dashboard/queues — the work queues previewed on the dashboard: pending agency
 * applications and 사무소 홈페이지 requests (oldest first), open deal requests (newest first), open reports grouped by target
 * (newest first, with this week's handling stats) and ads ending within ADS_ENDING_SOON_DAYS.
 * Same data for every admin, so it is cached briefly like the dashboard counters.
 */
@Injectable()
export class DashboardQueuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly media: MediaService,
  ) {}

  get(now: Date = new Date()): Promise<DashboardQueues> {
    return this.cache.getOrSet('cache:admin:dashboard:queues', DASHBOARD_CACHE_TTL_SECONDS, () =>
      this.compute(now),
    );
  }

  async compute(now: Date = new Date()): Promise<DashboardQueues> {
    const [pendingAgencies, pendingAgencySites, dealRequests, reports, expiringAds] =
      await Promise.all([
        this.pendingAgencies(),
        this.pendingAgencySites(),
        this.dealRequests(),
        this.reports(now),
        this.expiringAds(now),
      ]);
    return { pendingAgencies, pendingAgencySites, dealRequests, reports, expiringAds };
  }

  private async pendingAgencySites(): Promise<DashboardQueues['pendingAgencySites']> {
    const where: Prisma.AgencySiteWhereInput = {
      status: AgencySiteStatus.REQUESTED,
      agency: { deletedAt: null },
    };
    const [rows, total] = await Promise.all([
      this.prisma.agencySite.findMany({
        where,
        orderBy: [{ requestedAt: 'asc' }, { id: 'asc' }],
        take: QUEUE_PREVIEW,
        select: {
          agencyId: true,
          requestedSlug: true,
          requestedAt: true,
          agency: { select: { name: true } },
        },
      }),
      this.prisma.agencySite.count({ where }),
    ]);
    const items = rows.flatMap((r): DashboardPendingAgencySite[] =>
      r.requestedSlug
        ? [
            {
              agencyId: r.agencyId,
              agencyName: r.agency.name,
              requestedSlug: r.requestedSlug,
              requestedAt: r.requestedAt.toISOString(),
            },
          ]
        : [],
    );
    return { total, items };
  }

  private async pendingAgencies(): Promise<DashboardQueues['pendingAgencies']> {
    const where: Prisma.AgencyWhereInput = { deletedAt: null, status: AgencyStatus.PENDING };
    const [rows, total] = await Promise.all([
      this.prisma.agency.findMany({
        where,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: QUEUE_PREVIEW,
        select: {
          id: true,
          name: true,
          representativeName: true,
          registrationNumber: true,
          status: true,
          emdCode: true,
          createdAt: true,
          documents: { select: { type: true } },
        },
      }),
      this.prisma.agency.count({ where }),
    ]);
    const names = await regionNames(
      this.prisma,
      rows.map((r) => r.emdCode),
    );
    const items: DashboardPendingAgency[] = rows.map((a) => ({
      id: a.id,
      name: a.name,
      areaName: (a.emdCode && names.get(a.emdCode)) || null,
      representativeName: a.representativeName,
      registrationNumber: a.registrationNumber,
      status: a.status,
      appliedAt: a.createdAt.toISOString(),
      documents: documentChecklist(a.documents.map((d) => d.type)),
      registryStatus: null,
    }));
    return { total, items };
  }

  private async dealRequests(): Promise<DashboardQueues['dealRequests']> {
    const where: Prisma.DealRequestWhereInput = {
      deletedAt: null,
      status: { in: OPEN_DEAL_REQUEST_STATUSES },
    };
    const [rows, total] = await Promise.all([
      this.prisma.dealRequest.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: QUEUE_PREVIEW,
        select: dealRequestSelect,
      }),
      this.prisma.dealRequest.count({ where }),
    ]);
    const complexIds = [...new Set(rows.flatMap((r) => r.complexIds))];
    const [names, complexes] = await Promise.all([
      regionNames(
        this.prisma,
        rows.flatMap((r) => [r.emdCode, ...r.regionCodes]),
      ),
      complexIds.length
        ? this.prisma.complex.findMany({
            where: { id: { in: complexIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);
    const complexNames = new Map(complexes.map((c) => [c.id, c.name]));
    const items = rows.map((r) => toDashboardDealRequest(r, names, complexNames));
    return { total, items };
  }

  private async reports(now: Date): Promise<DashboardQueues['reports']> {
    const open: Prisma.ReportWhereInput = { status: { in: [...OPEN_REPORT_STATUSES] } };
    const weekStart = startOfKstWeek(now);
    const [groups, handled] = await Promise.all([
      this.prisma.report.groupBy({
        by: ['targetType', 'listingId', 'agencyId'],
        where: open,
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _max: { createdAt: 'desc' } },
      }),
      this.prisma.report.findMany({
        where: {
          status: { in: [ReportStatus.RESOLVED, ReportStatus.REJECTED] },
          handledAt: { gte: weekStart },
        },
        select: { createdAt: true, handledAt: true },
      }),
    ]);
    const preview = groups.slice(0, QUEUE_PREVIEW);
    const items = await Promise.all(
      preview.map(async (g): Promise<DashboardReport | null> => {
        const newest = await this.prisma.report.findFirst({
          where: {
            ...open,
            targetType: g.targetType,
            listingId: g.listingId,
            agencyId: g.agencyId,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            reason: true,
            createdAt: true,
            listing: {
              select: {
                id: true,
                title: true,
                dealType: true,
                salePrice: true,
                presalePrice: true,
                deposit: true,
                monthlyRent: true,
                exclusiveArea: true,
                complex: { select: { name: true } },
                property: { select: { buildingName: true, roadAddress: true } },
                primaryAgency: { select: { name: true } },
              },
            },
            agency: { select: { id: true, name: true } },
          },
        });
        if (!newest) return null;
        const isListing = g.targetType === ReportTargetType.LISTING;
        const targetId = (isListing ? g.listingId : g.agencyId) ?? newest.id;
        return {
          id: newest.id,
          targetType: g.targetType,
          targetId,
          reason: newest.reason,
          title: isListing
            ? newest.listing
              ? listingHeadline(newest.listing)
              : '삭제된 매물'
            : (newest.agency?.name ?? '삭제된 중개사무소'),
          agencyName: newest.listing?.primaryAgency.name ?? newest.agency?.name ?? null,
          reportCount: g._count._all,
          lastReportedAt: (g._max.createdAt ?? newest.createdAt).toISOString(),
        };
      }),
    );
    return {
      total: groups.length,
      items: items.filter((i): i is DashboardReport => i !== null),
      handledThisWeek: handled.length,
      avgHandleHours: averageHandleHours(handled),
    };
  }

  private async expiringAds(now: Date): Promise<DashboardQueues['expiringAds']> {
    const soon = new Date(now.getTime() + ADS_ENDING_SOON_DAYS * DAY_MS);
    const live = {
      deletedAt: null,
      paused: false,
      startAt: { lte: now },
      endAt: { gt: now, lte: soon },
    };
    const mediaRef = { select: { storageKey: true, variants: true } } as const;
    const [banners, bannerCount, popups, popupCount] = await Promise.all([
      this.prisma.banner.findMany({
        where: live,
        orderBy: [{ endAt: 'asc' }, { id: 'asc' }],
        take: QUEUE_PREVIEW,
        select: {
          id: true,
          title: true,
          advertiserName: true,
          slot: true,
          endAt: true,
          agency: { select: { name: true } },
          pcMedia: mediaRef,
        },
      }),
      this.prisma.banner.count({ where: live }),
      this.prisma.popup.findMany({
        where: live,
        orderBy: [{ endAt: 'asc' }, { id: 'asc' }],
        take: QUEUE_PREVIEW,
        select: { id: true, title: true, endAt: true, media: mediaRef },
      }),
      this.prisma.popup.count({ where: live }),
    ]);
    const stats = banners.length
      ? await this.prisma.bannerStatDaily.groupBy({
          by: ['bannerId'],
          where: { bannerId: { in: banners.map((b) => b.id) } },
          _sum: { impressions: true, clicks: true },
        })
      : [];
    const byBanner = new Map(stats.map((s) => [s.bannerId, s._sum]));
    const all: DashboardExpiringAd[] = [
      ...banners.map((b): DashboardExpiringAd => {
        const s = byBanner.get(b.id);
        return {
          id: b.id,
          kind: 'BANNER',
          advertiserName: b.advertiserName ?? b.agency?.name ?? b.title,
          slot: b.slot,
          placementLabel: null,
          endAt: b.endAt.toISOString(),
          ctr: ctrOf(s?.impressions ?? 0, s?.clicks ?? 0),
          imageUrl: this.media.url(b.pcMedia, 'thumb'),
        };
      }),
      ...popups.map(
        (p): DashboardExpiringAd => ({
          id: p.id,
          kind: 'POPUP',
          advertiserName: p.title,
          slot: null,
          placementLabel: '팝업',
          endAt: p.endAt.toISOString(),
          ctr: null,
          imageUrl: this.media.url(p.media, 'thumb'),
        }),
      ),
    ];
    all.sort((a, b) => a.endAt.localeCompare(b.endAt) || a.id.localeCompare(b.id));
    return { total: bannerCount + popupCount, items: all.slice(0, QUEUE_PREVIEW) };
  }
}

/** One deal request as a dashboard row ("신대 레이크파크 1단지 · 34평", price, condition). */
export function toDashboardDealRequest(
  r: DealRequestRow,
  regions: Map<string, string>,
  complexNames: Map<string, string>,
): DashboardDealRequest {
  const dealType = r.dealTypes[0] ?? DealType.SALE;
  const sell = r.type === DealRequestType.SELL_OR_LEASE;
  const place = sell
    ? (r.complex?.name ?? (r.emdCode ? regions.get(r.emdCode) : undefined))
    : (r.complexIds.map((id) => complexNames.get(id)).find(Boolean) ??
      r.regionCodes.map((c) => regions.get(c)).find(Boolean));
  const size = pyeongLabel(sell ? r.exclusiveArea : (r.areaMin ?? r.areaMax));
  const title = [place ?? '순천시 전체', size].filter(Boolean).join(' · ');
  const prices = sell
    ? priceFields(dealType, {
        salePrice: r.desiredSalePrice,
        presalePrice: r.desiredSalePrice,
        deposit: r.desiredDeposit,
        monthlyRent: r.desiredMonthlyRent,
      })
    : priceFields(dealType, {
        salePrice: r.priceMax,
        presalePrice: r.priceMax,
        deposit: r.depositMax,
        monthlyRent: r.rentMax,
      });
  let note: string | null = null;
  if (sell && r.floor != null) note = `${r.floor}층`;
  if (!sell && r.moveInDate) {
    const d = r.moveInDate;
    note = `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 입주`;
  }
  return {
    id: r.id,
    type: r.type,
    title,
    dealType,
    ...prices,
    note,
    createdAt: r.createdAt.toISOString(),
    deliveredAgencyCount: r._count.targets,
    activeProposalCount: r._count.proposals,
  };
}
