import {
  AgencyStatus,
  computeScheduleStatus,
  MediaStatus,
  type AdminBannerView,
  type AdminPopupView,
  type PublicBannerView,
  type PublicPopupView,
} from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AppConfig } from '../../config/app-config.service';
import { ADS_MEDIA, adMediaSelect, type AdsMediaPort } from './ports/ads-media.port';

export const adminBannerSelect = {
  id: true,
  slot: true,
  title: true,
  advertiserName: true,
  linkUrl: true,
  newWindow: true,
  startAt: true,
  endAt: true,
  paused: true,
  priority: true,
  sortOrder: true,
  targeting: true,
  memo: true,
  createdByAdminId: true,
  createdAt: true,
  updatedAt: true,
  agency: { select: { id: true, name: true } },
  pcMedia: { select: adMediaSelect },
  mobileMedia: { select: adMediaSelect },
  targetRegions: { select: { regionCode: true }, orderBy: { regionCode: 'asc' } },
  targetComplexes: {
    select: { complex: { select: { id: true, name: true } } },
    orderBy: { complexId: 'asc' },
  },
} satisfies Prisma.BannerSelect;
export type AdminBannerRow = Prisma.BannerGetPayload<{ select: typeof adminBannerSelect }>;

export const publicBannerSelect = {
  id: true,
  slot: true,
  title: true,
  advertiserName: true,
  linkUrl: true,
  newWindow: true,
  priority: true,
  sortOrder: true,
  endAt: true,
  agency: { select: { id: true, name: true, status: true, deletedAt: true } },
  pcMedia: { select: adMediaSelect },
  // Optional image: the row is served without it when it was removed (pc image is filtered in SQL).
  mobileMedia: { select: { ...adMediaSelect, status: true, deletedAt: true } },
} satisfies Prisma.BannerSelect;
export type PublicBannerRow = Prisma.BannerGetPayload<{ select: typeof publicBannerSelect }>;

export const adminPopupSelect = {
  id: true,
  title: true,
  linkUrl: true,
  newWindow: true,
  targetPages: true,
  startAt: true,
  endAt: true,
  paused: true,
  dismissDays: true,
  sortOrder: true,
  createdByAdminId: true,
  createdAt: true,
  updatedAt: true,
  media: { select: adMediaSelect },
} satisfies Prisma.PopupSelect;
export type AdminPopupRow = Prisma.PopupGetPayload<{ select: typeof adminPopupSelect }>;

export const publicPopupSelect = {
  id: true,
  title: true,
  linkUrl: true,
  newWindow: true,
  dismissDays: true,
  endAt: true,
  media: { select: adMediaSelect },
} satisfies Prisma.PopupSelect;
export type PublicPopupRow = Prisma.PopupGetPayload<{ select: typeof publicPopupSelect }>;

/** DB rows → API views (explicit field picking; memo/admin ids never reach public views). */
@Injectable()
export class AdsMapper {
  private readonly apiBase: string;

  constructor(
    @Inject(ADS_MEDIA) private readonly media: AdsMediaPort,
    config: AppConfig,
  ) {
    this.apiBase = config.get('API_BASE_URL').replace(/\/+$/, '');
  }

  clickUrl(bannerId: string): string {
    return `${this.apiBase}/api/v1/banners/${bannerId}/click`;
  }

  adminBanner(b: AdminBannerRow, now: Date = new Date()): AdminBannerView {
    return {
      id: b.id,
      slot: b.slot,
      title: b.title,
      advertiserName: b.advertiserName,
      agency: b.agency ? { id: b.agency.id, name: b.agency.name } : null,
      pcImage: this.media.view(b.pcMedia),
      mobileImage: b.mobileMedia ? this.media.view(b.mobileMedia) : null,
      linkUrl: b.linkUrl,
      newWindow: b.newWindow,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      paused: b.paused,
      status: computeScheduleStatus(b, now),
      priority: b.priority,
      sortOrder: b.sortOrder,
      targeting: b.targeting,
      targetRegionCodes: b.targetRegions.map((r) => r.regionCode),
      targetComplexes: b.targetComplexes.map((t) => ({ id: t.complex.id, name: t.complex.name })),
      memo: b.memo,
      createdByAdminId: b.createdByAdminId,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
    };
  }

  publicBanner(b: PublicBannerRow): PublicBannerView {
    const agency =
      b.agency && b.agency.status === AgencyStatus.APPROVED && !b.agency.deletedAt
        ? { id: b.agency.id, name: b.agency.name }
        : null;
    return {
      id: b.id,
      slot: b.slot,
      title: b.title,
      advertiserName: b.advertiserName,
      agency,
      imageUrl: this.media.url(b.pcMedia),
      mobileImageUrl:
        b.mobileMedia && !b.mobileMedia.deletedAt && b.mobileMedia.status === MediaStatus.READY
          ? this.media.url(b.mobileMedia)
          : null,
      clickUrl: b.linkUrl ? this.clickUrl(b.id) : null,
      newWindow: b.newWindow,
    };
  }

  adminPopup(p: AdminPopupRow, now: Date = new Date()): AdminPopupView {
    return {
      id: p.id,
      title: p.title,
      image: this.media.view(p.media),
      linkUrl: p.linkUrl,
      newWindow: p.newWindow,
      targetPages: p.targetPages,
      startAt: p.startAt.toISOString(),
      endAt: p.endAt.toISOString(),
      paused: p.paused,
      status: computeScheduleStatus(p, now),
      dismissDays: p.dismissDays,
      sortOrder: p.sortOrder,
      createdByAdminId: p.createdByAdminId,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  publicPopup(p: PublicPopupRow): PublicPopupView {
    return {
      id: p.id,
      title: p.title,
      imageUrl: this.media.url(p.media),
      linkUrl: p.linkUrl,
      newWindow: p.newWindow,
      dismissDays: p.dismissDays,
      endAt: p.endAt.toISOString(),
    };
  }
}
