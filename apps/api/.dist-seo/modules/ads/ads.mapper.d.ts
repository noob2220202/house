import { type AdminBannerView, type AdminPopupView, type PublicBannerView, type PublicPopupView } from '@house/shared';
import type { Prisma } from '@prisma/client';
import { AppConfig } from '../../config/app-config.service';
import { type AdsMediaPort } from './ports/ads-media.port';
export declare const adminBannerSelect: {
    id: true;
    slot: true;
    title: true;
    advertiserName: true;
    linkUrl: true;
    newWindow: true;
    startAt: true;
    endAt: true;
    paused: true;
    priority: true;
    sortOrder: true;
    targeting: true;
    memo: true;
    createdByAdminId: true;
    createdAt: true;
    updatedAt: true;
    agency: {
        select: {
            id: true;
            name: true;
        };
    };
    pcMedia: {
        select: {
            id: true;
            storageKey: true;
            variants: true;
            width: true;
            height: true;
        };
    };
    mobileMedia: {
        select: {
            id: true;
            storageKey: true;
            variants: true;
            width: true;
            height: true;
        };
    };
    targetRegions: {
        select: {
            regionCode: true;
        };
        orderBy: {
            regionCode: "asc";
        };
    };
    targetComplexes: {
        select: {
            complex: {
                select: {
                    id: true;
                    name: true;
                };
            };
        };
        orderBy: {
            complexId: "asc";
        };
    };
};
export type AdminBannerRow = Prisma.BannerGetPayload<{
    select: typeof adminBannerSelect;
}>;
export declare const publicBannerSelect: {
    id: true;
    slot: true;
    title: true;
    advertiserName: true;
    linkUrl: true;
    newWindow: true;
    priority: true;
    sortOrder: true;
    endAt: true;
    agency: {
        select: {
            id: true;
            name: true;
            status: true;
            deletedAt: true;
        };
    };
    pcMedia: {
        select: {
            id: true;
            storageKey: true;
            variants: true;
            width: true;
            height: true;
        };
    };
    mobileMedia: {
        select: {
            status: true;
            deletedAt: true;
            id: true;
            storageKey: true;
            variants: true;
            width: true;
            height: true;
        };
    };
};
export type PublicBannerRow = Prisma.BannerGetPayload<{
    select: typeof publicBannerSelect;
}>;
export declare const adminPopupSelect: {
    id: true;
    title: true;
    linkUrl: true;
    newWindow: true;
    targetPages: true;
    startAt: true;
    endAt: true;
    paused: true;
    dismissDays: true;
    sortOrder: true;
    createdByAdminId: true;
    createdAt: true;
    updatedAt: true;
    media: {
        select: {
            id: true;
            storageKey: true;
            variants: true;
            width: true;
            height: true;
        };
    };
};
export type AdminPopupRow = Prisma.PopupGetPayload<{
    select: typeof adminPopupSelect;
}>;
export declare const publicPopupSelect: {
    id: true;
    title: true;
    linkUrl: true;
    newWindow: true;
    dismissDays: true;
    endAt: true;
    media: {
        select: {
            id: true;
            storageKey: true;
            variants: true;
            width: true;
            height: true;
        };
    };
};
export type PublicPopupRow = Prisma.PopupGetPayload<{
    select: typeof publicPopupSelect;
}>;
/** DB rows → API views (explicit field picking; memo/admin ids never reach public views). */
export declare class AdsMapper {
    private readonly media;
    private readonly apiBase;
    constructor(media: AdsMediaPort, config: AppConfig);
    clickUrl(bannerId: string): string;
    adminBanner(b: AdminBannerRow, now?: Date): AdminBannerView;
    publicBanner(b: PublicBannerRow): PublicBannerView;
    adminPopup(p: AdminPopupRow, now?: Date): AdminPopupView;
    publicPopup(p: PublicPopupRow): PublicPopupView;
}
