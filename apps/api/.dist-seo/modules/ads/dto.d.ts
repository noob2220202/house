declare const IdParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    id: import("zod").ZodUUID;
}, import("zod/v4/core").$strip>>;
export declare class IdParamDto extends IdParamDto_base {
}
declare const CreateBannerDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    advertiserName: import("zod").ZodOptional<import("zod").ZodString>;
    agencyId: import("zod").ZodOptional<import("zod").ZodUUID>;
    mobileMediaId: import("zod").ZodOptional<import("zod").ZodUUID>;
    linkUrl: import("zod").ZodOptional<import("zod").ZodString>;
    memo: import("zod").ZodOptional<import("zod").ZodString>;
    newWindow: import("zod").ZodDefault<import("zod").ZodBoolean>;
    paused: import("zod").ZodDefault<import("zod").ZodBoolean>;
    priority: import("zod").ZodDefault<import("zod").ZodInt>;
    targeting: import("zod").ZodDefault<import("zod").ZodEnum<{
        readonly ALL: "ALL";
        readonly REGIONS: "REGIONS";
        readonly COMPLEXES: "COMPLEXES";
    }>>;
    targetRegionCodes: import("zod").ZodDefault<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>, import("zod").ZodTransform<string[], string[]>>>;
    targetComplexIds: import("zod").ZodDefault<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodUUID>, import("zod").ZodTransform<string[], string[]>>>;
    slot: import("zod").ZodEnum<{
        readonly MAIN_HERO: "MAIN_HERO";
        readonly MAIN_STRIP: "MAIN_STRIP";
        readonly MAP_AD: "MAP_AD";
        readonly COMPLEX_FEATURED_AGENCY: "COMPLEX_FEATURED_AGENCY";
        readonly LISTING_SIDE: "LISTING_SIDE";
        readonly AGENCY_SEARCH_TOP: "AGENCY_SEARCH_TOP";
        readonly MOBILE_MAIN: "MOBILE_MAIN";
    }>;
    title: import("zod").ZodString;
    pcMediaId: import("zod").ZodUUID;
    startAt: import("zod").ZodISODateTime;
    endAt: import("zod").ZodISODateTime;
}, import("zod/v4/core").$strip>>;
export declare class CreateBannerDto extends CreateBannerDto_base {
}
declare const UpdateBannerDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    title: import("zod").ZodOptional<import("zod").ZodString>;
    advertiserName: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    agencyId: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUUID>>;
    pcMediaId: import("zod").ZodOptional<import("zod").ZodUUID>;
    mobileMediaId: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUUID>>;
    linkUrl: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    newWindow: import("zod").ZodOptional<import("zod").ZodBoolean>;
    startAt: import("zod").ZodOptional<import("zod").ZodISODateTime>;
    endAt: import("zod").ZodOptional<import("zod").ZodISODateTime>;
    paused: import("zod").ZodOptional<import("zod").ZodBoolean>;
    priority: import("zod").ZodOptional<import("zod").ZodInt>;
    targeting: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly ALL: "ALL";
        readonly REGIONS: "REGIONS";
        readonly COMPLEXES: "COMPLEXES";
    }>>;
    targetRegionCodes: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>, import("zod").ZodTransform<string[], string[]>>>;
    targetComplexIds: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodUUID>, import("zod").ZodTransform<string[], string[]>>>;
    memo: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
}, import("zod/v4/core").$strict>>;
export declare class UpdateBannerDto extends UpdateBannerDto_base {
}
declare const ReorderBannersDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    slot: import("zod").ZodEnum<{
        readonly MAIN_HERO: "MAIN_HERO";
        readonly MAIN_STRIP: "MAIN_STRIP";
        readonly MAP_AD: "MAP_AD";
        readonly COMPLEX_FEATURED_AGENCY: "COMPLEX_FEATURED_AGENCY";
        readonly LISTING_SIDE: "LISTING_SIDE";
        readonly AGENCY_SEARCH_TOP: "AGENCY_SEARCH_TOP";
        readonly MOBILE_MAIN: "MOBILE_MAIN";
    }>;
    ids: import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodUUID>, import("zod").ZodTransform<string[], string[]>>, import("zod").ZodArray<import("zod").ZodUUID>>;
}, import("zod/v4/core").$strip>>;
export declare class ReorderBannersDto extends ReorderBannersDto_base {
}
declare const AdminBannerListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    slot: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly MAIN_HERO: "MAIN_HERO";
        readonly MAIN_STRIP: "MAIN_STRIP";
        readonly MAP_AD: "MAP_AD";
        readonly COMPLEX_FEATURED_AGENCY: "COMPLEX_FEATURED_AGENCY";
        readonly LISTING_SIDE: "LISTING_SIDE";
        readonly AGENCY_SEARCH_TOP: "AGENCY_SEARCH_TOP";
        readonly MOBILE_MAIN: "MOBILE_MAIN";
    }>>;
    status: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly ACTIVE: "ACTIVE";
        readonly PAUSED: "PAUSED";
        readonly SCHEDULED: "SCHEDULED";
        readonly ENDED: "ENDED";
    }>>;
    agencyId: import("zod").ZodOptional<import("zod").ZodUUID>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class AdminBannerListQueryDto extends AdminBannerListQueryDto_base {
}
declare const BannerStatsQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    from: import("zod").ZodOptional<import("zod").ZodISODate>;
    to: import("zod").ZodOptional<import("zod").ZodISODate>;
}, import("zod/v4/core").$strip>>;
export declare class BannerStatsQueryDto extends BannerStatsQueryDto_base {
}
declare const BannerSlotParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    slot: import("zod").ZodEnum<{
        readonly MAIN_HERO: "MAIN_HERO";
        readonly MAIN_STRIP: "MAIN_STRIP";
        readonly MAP_AD: "MAP_AD";
        readonly COMPLEX_FEATURED_AGENCY: "COMPLEX_FEATURED_AGENCY";
        readonly LISTING_SIDE: "LISTING_SIDE";
        readonly AGENCY_SEARCH_TOP: "AGENCY_SEARCH_TOP";
        readonly MOBILE_MAIN: "MOBILE_MAIN";
    }>;
}, import("zod/v4/core").$strip>>;
export declare class BannerSlotParamDto extends BannerSlotParamDto_base {
}
declare const UpdateBannerSlotDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    maxActive: import("zod").ZodOptional<import("zod").ZodInt>;
    isEnabled: import("zod").ZodOptional<import("zod").ZodBoolean>;
    note: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
}, import("zod/v4/core").$strict>>;
export declare class UpdateBannerSlotDto extends UpdateBannerSlotDto_base {
}
declare const CreatePopupDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    linkUrl: import("zod").ZodOptional<import("zod").ZodString>;
    newWindow: import("zod").ZodDefault<import("zod").ZodBoolean>;
    paused: import("zod").ZodDefault<import("zod").ZodBoolean>;
    dismissDays: import("zod").ZodDefault<import("zod").ZodInt>;
    title: import("zod").ZodString;
    mediaId: import("zod").ZodUUID;
    targetPages: import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly ALL: "ALL";
        readonly MAIN: "MAIN";
        readonly MAP: "MAP";
        readonly COMPLEX_DETAIL: "COMPLEX_DETAIL";
        readonly LISTING_DETAIL: "LISTING_DETAIL";
        readonly AGENCY_LIST: "AGENCY_LIST";
        readonly DEAL_REQUEST: "DEAL_REQUEST";
    }>>, import("zod").ZodTransform<("DEAL_REQUEST" | "ALL" | "MAIN" | "MAP" | "COMPLEX_DETAIL" | "LISTING_DETAIL" | "AGENCY_LIST")[], ("DEAL_REQUEST" | "ALL" | "MAIN" | "MAP" | "COMPLEX_DETAIL" | "LISTING_DETAIL" | "AGENCY_LIST")[]>>, import("zod").ZodArray<import("zod").ZodEnum<{
        readonly ALL: "ALL";
        readonly MAIN: "MAIN";
        readonly MAP: "MAP";
        readonly COMPLEX_DETAIL: "COMPLEX_DETAIL";
        readonly LISTING_DETAIL: "LISTING_DETAIL";
        readonly AGENCY_LIST: "AGENCY_LIST";
        readonly DEAL_REQUEST: "DEAL_REQUEST";
    }>>>;
    startAt: import("zod").ZodISODateTime;
    endAt: import("zod").ZodISODateTime;
}, import("zod/v4/core").$strip>>;
export declare class CreatePopupDto extends CreatePopupDto_base {
}
declare const UpdatePopupDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    title: import("zod").ZodOptional<import("zod").ZodString>;
    mediaId: import("zod").ZodOptional<import("zod").ZodUUID>;
    linkUrl: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    newWindow: import("zod").ZodOptional<import("zod").ZodBoolean>;
    targetPages: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly ALL: "ALL";
        readonly MAIN: "MAIN";
        readonly MAP: "MAP";
        readonly COMPLEX_DETAIL: "COMPLEX_DETAIL";
        readonly LISTING_DETAIL: "LISTING_DETAIL";
        readonly AGENCY_LIST: "AGENCY_LIST";
        readonly DEAL_REQUEST: "DEAL_REQUEST";
    }>>, import("zod").ZodTransform<("DEAL_REQUEST" | "ALL" | "MAIN" | "MAP" | "COMPLEX_DETAIL" | "LISTING_DETAIL" | "AGENCY_LIST")[], ("DEAL_REQUEST" | "ALL" | "MAIN" | "MAP" | "COMPLEX_DETAIL" | "LISTING_DETAIL" | "AGENCY_LIST")[]>>, import("zod").ZodArray<import("zod").ZodEnum<{
        readonly ALL: "ALL";
        readonly MAIN: "MAIN";
        readonly MAP: "MAP";
        readonly COMPLEX_DETAIL: "COMPLEX_DETAIL";
        readonly LISTING_DETAIL: "LISTING_DETAIL";
        readonly AGENCY_LIST: "AGENCY_LIST";
        readonly DEAL_REQUEST: "DEAL_REQUEST";
    }>>>>;
    startAt: import("zod").ZodOptional<import("zod").ZodISODateTime>;
    endAt: import("zod").ZodOptional<import("zod").ZodISODateTime>;
    paused: import("zod").ZodOptional<import("zod").ZodBoolean>;
    dismissDays: import("zod").ZodOptional<import("zod").ZodInt>;
}, import("zod/v4/core").$strict>>;
export declare class UpdatePopupDto extends UpdatePopupDto_base {
}
declare const ReorderPopupsDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    ids: import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodUUID>, import("zod").ZodTransform<string[], string[]>>, import("zod").ZodArray<import("zod").ZodUUID>>;
}, import("zod/v4/core").$strip>>;
export declare class ReorderPopupsDto extends ReorderPopupsDto_base {
}
declare const AdminPopupListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    status: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly ACTIVE: "ACTIVE";
        readonly PAUSED: "PAUSED";
        readonly SCHEDULED: "SCHEDULED";
        readonly ENDED: "ENDED";
    }>>;
    targetPage: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly ALL: "ALL";
        readonly MAIN: "MAIN";
        readonly MAP: "MAP";
        readonly COMPLEX_DETAIL: "COMPLEX_DETAIL";
        readonly LISTING_DETAIL: "LISTING_DETAIL";
        readonly AGENCY_LIST: "AGENCY_LIST";
        readonly DEAL_REQUEST: "DEAL_REQUEST";
    }>>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class AdminPopupListQueryDto extends AdminPopupListQueryDto_base {
}
declare const BannerServeQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    slot: import("zod").ZodEnum<{
        readonly MAIN_HERO: "MAIN_HERO";
        readonly MAIN_STRIP: "MAIN_STRIP";
        readonly MAP_AD: "MAP_AD";
        readonly COMPLEX_FEATURED_AGENCY: "COMPLEX_FEATURED_AGENCY";
        readonly LISTING_SIDE: "LISTING_SIDE";
        readonly AGENCY_SEARCH_TOP: "AGENCY_SEARCH_TOP";
        readonly MOBILE_MAIN: "MOBILE_MAIN";
    }>;
    regionCode: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>;
    complexId: import("zod").ZodOptional<import("zod").ZodUUID>;
}, import("zod/v4/core").$strip>>;
export declare class BannerServeQueryDto extends BannerServeQueryDto_base {
}
declare const PopupServeQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodEnum<{
        readonly ALL: "ALL";
        readonly MAIN: "MAIN";
        readonly MAP: "MAP";
        readonly COMPLEX_DETAIL: "COMPLEX_DETAIL";
        readonly LISTING_DETAIL: "LISTING_DETAIL";
        readonly AGENCY_LIST: "AGENCY_LIST";
        readonly DEAL_REQUEST: "DEAL_REQUEST";
    }>;
}, import("zod/v4/core").$strip>>;
export declare class PopupServeQueryDto extends PopupServeQueryDto_base {
}
declare const BannerImpressionBatchDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    ids: import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodArray<import("zod").ZodUUID>, import("zod").ZodTransform<string[], string[]>>, import("zod").ZodArray<import("zod").ZodUUID>>;
}, import("zod/v4/core").$strip>>;
export declare class BannerImpressionBatchDto extends BannerImpressionBatchDto_base {
}
export {};
