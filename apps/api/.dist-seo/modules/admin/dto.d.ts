declare const IdParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    id: import("zod").ZodUUID;
}, import("zod/v4/core").$strip>>;
export declare class IdParamDto extends IdParamDto_base {
}
declare const PaginationQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
}, import("zod/v4/core").$strip>>;
export declare class PaginationQueryDto extends PaginationQueryDto_base {
}
declare const ReportCreateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    targetType: import("zod").ZodEnum<{
        readonly LISTING: "LISTING";
        readonly AGENCY: "AGENCY";
    }>;
    targetId: import("zod").ZodUUID;
    reason: import("zod").ZodEnum<{
        readonly NOT_EXIST: "NOT_EXIST";
        readonly ALREADY_DEALT: "ALREADY_DEALT";
        readonly WRONG_PRICE: "WRONG_PRICE";
        readonly WRONG_INFO: "WRONG_INFO";
        readonly WRONG_PHOTO: "WRONG_PHOTO";
        readonly DUPLICATE: "DUPLICATE";
        readonly UNREACHABLE: "UNREACHABLE";
        readonly OTHER: "OTHER";
    }>;
    detail: import("zod").ZodOptional<import("zod").ZodString>;
    reporterPhone: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>;
}, import("zod/v4/core").$strip>>;
export declare class ReportCreateDto extends ReportCreateDto_base {
}
declare const ReportListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    status: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly RECEIVED: "RECEIVED";
        readonly IN_REVIEW: "IN_REVIEW";
        readonly RESOLVED: "RESOLVED";
        readonly REJECTED: "REJECTED";
    }>>;
    targetType: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly LISTING: "LISTING";
        readonly AGENCY: "AGENCY";
    }>>;
    reason: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly NOT_EXIST: "NOT_EXIST";
        readonly ALREADY_DEALT: "ALREADY_DEALT";
        readonly WRONG_PRICE: "WRONG_PRICE";
        readonly WRONG_INFO: "WRONG_INFO";
        readonly WRONG_PHOTO: "WRONG_PHOTO";
        readonly DUPLICATE: "DUPLICATE";
        readonly UNREACHABLE: "UNREACHABLE";
        readonly OTHER: "OTHER";
    }>>;
    listingId: import("zod").ZodOptional<import("zod").ZodUUID>;
    agencyId: import("zod").ZodOptional<import("zod").ZodUUID>;
}, import("zod/v4/core").$strip>>;
export declare class ReportListQueryDto extends ReportListQueryDto_base {
}
declare const ReportReviewDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    status: import("zod").ZodOptional<import("zod").ZodLiteral<"IN_REVIEW">>;
    note: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class ReportReviewDto extends ReportReviewDto_base {
}
declare const ReportResolveDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    status: import("zod").ZodEnum<{
        REJECTED: "REJECTED";
        RESOLVED: "RESOLVED";
    }>;
    action: import("zod").ZodDefault<import("zod").ZodEnum<{
        readonly NONE: "NONE";
        readonly LISTING_HIDDEN: "LISTING_HIDDEN";
        readonly AGENCY_WARNED: "AGENCY_WARNED";
        readonly LISTING_HIDDEN_AGENCY_WARNED: "LISTING_HIDDEN_AGENCY_WARNED";
    }>>;
    note: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class ReportResolveDto extends ReportResolveDto_base {
}
declare const NoticeInputDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    isPinned: import("zod").ZodDefault<import("zod").ZodBoolean>;
    isPublished: import("zod").ZodDefault<import("zod").ZodBoolean>;
    title: import("zod").ZodString;
    content: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class NoticeInputDto extends NoticeInputDto_base {
}
declare const NoticeUpdateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    title: import("zod").ZodOptional<import("zod").ZodString>;
    content: import("zod").ZodOptional<import("zod").ZodString>;
    isPinned: import("zod").ZodOptional<import("zod").ZodBoolean>;
    isPublished: import("zod").ZodOptional<import("zod").ZodBoolean>;
}, import("zod/v4/core").$strip>>;
export declare class NoticeUpdateDto extends NoticeUpdateDto_base {
}
declare const NoticeAdminListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
    isPublished: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>;
}, import("zod/v4/core").$strip>>;
export declare class NoticeAdminListQueryDto extends NoticeAdminListQueryDto_base {
}
declare const FaqInputDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    isPublished: import("zod").ZodDefault<import("zod").ZodBoolean>;
    sortOrder: import("zod").ZodOptional<import("zod").ZodInt>;
    category: import("zod").ZodEnum<{
        readonly GENERAL: "GENERAL";
        readonly ACCOUNT: "ACCOUNT";
        readonly LISTING: "LISTING";
        readonly AGENCY: "AGENCY";
        readonly DEAL_REQUEST: "DEAL_REQUEST";
        readonly AD: "AD";
    }>;
    question: import("zod").ZodString;
    answer: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class FaqInputDto extends FaqInputDto_base {
}
declare const FaqUpdateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    category: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly GENERAL: "GENERAL";
        readonly ACCOUNT: "ACCOUNT";
        readonly LISTING: "LISTING";
        readonly AGENCY: "AGENCY";
        readonly DEAL_REQUEST: "DEAL_REQUEST";
        readonly AD: "AD";
    }>>;
    question: import("zod").ZodOptional<import("zod").ZodString>;
    answer: import("zod").ZodOptional<import("zod").ZodString>;
    isPublished: import("zod").ZodOptional<import("zod").ZodBoolean>;
    sortOrder: import("zod").ZodOptional<import("zod").ZodInt>;
}, import("zod/v4/core").$strip>>;
export declare class FaqUpdateDto extends FaqUpdateDto_base {
}
declare const FaqOrderDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    ids: import("zod").ZodArray<import("zod").ZodUUID>;
}, import("zod/v4/core").$strip>>;
export declare class FaqOrderDto extends FaqOrderDto_base {
}
declare const FaqListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    category: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly GENERAL: "GENERAL";
        readonly ACCOUNT: "ACCOUNT";
        readonly LISTING: "LISTING";
        readonly AGENCY: "AGENCY";
        readonly DEAL_REQUEST: "DEAL_REQUEST";
        readonly AD: "AD";
    }>>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class FaqListQueryDto extends FaqListQueryDto_base {
}
declare const FaqAdminListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    category: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly GENERAL: "GENERAL";
        readonly ACCOUNT: "ACCOUNT";
        readonly LISTING: "LISTING";
        readonly AGENCY: "AGENCY";
        readonly DEAL_REQUEST: "DEAL_REQUEST";
        readonly AD: "AD";
    }>>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
    isPublished: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>;
}, import("zod/v4/core").$strip>>;
export declare class FaqAdminListQueryDto extends FaqAdminListQueryDto_base {
}
declare const LocalVideoInputDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    description: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    regionCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>>;
    complexId: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUUID>>;
    sortOrder: import("zod").ZodDefault<import("zod").ZodInt>;
    isPublished: import("zod").ZodDefault<import("zod").ZodBoolean>;
    title: import("zod").ZodString;
    youtubeUrl: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class LocalVideoInputDto extends LocalVideoInputDto_base {
}
declare const LocalVideoUpdateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    title: import("zod").ZodOptional<import("zod").ZodString>;
    youtubeUrl: import("zod").ZodOptional<import("zod").ZodString>;
    description: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodString>>;
    regionCode: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>>;
    complexId: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodUUID>>;
    sortOrder: import("zod").ZodOptional<import("zod").ZodInt>;
    isPublished: import("zod").ZodOptional<import("zod").ZodBoolean>;
}, import("zod/v4/core").$strip>>;
export declare class LocalVideoUpdateDto extends LocalVideoUpdateDto_base {
}
declare const LocalVideoListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    regionCode: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>;
    complexId: import("zod").ZodOptional<import("zod").ZodUUID>;
}, import("zod/v4/core").$strip>>;
export declare class LocalVideoListQueryDto extends LocalVideoListQueryDto_base {
}
declare const LocalVideoAdminListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    regionCode: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>>;
    complexId: import("zod").ZodOptional<import("zod").ZodUUID>;
    isPublished: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class LocalVideoAdminListQueryDto extends LocalVideoAdminListQueryDto_base {
}
declare const TermsInputDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    type: import("zod").ZodEnum<{
        readonly SERVICE: "SERVICE";
        readonly PRIVACY: "PRIVACY";
        readonly LOCATION: "LOCATION";
        readonly MARKETING: "MARKETING";
        readonly PRIVACY_AGENCY_APPLICATION: "PRIVACY_AGENCY_APPLICATION";
        readonly PRIVACY_AGENCY_JOIN: "PRIVACY_AGENCY_JOIN";
        readonly DEAL_REQUEST_PRIVACY: "DEAL_REQUEST_PRIVACY";
        readonly DEAL_REQUEST_PROVIDE: "DEAL_REQUEST_PROVIDE";
    }>;
    version: import("zod").ZodString;
    title: import("zod").ZodString;
    content: import("zod").ZodString;
    isRequired: import("zod").ZodBoolean;
    effectiveAt: import("zod").ZodISODateTime;
}, import("zod/v4/core").$strip>>;
export declare class TermsInputDto extends TermsInputDto_base {
}
declare const TermsUpdateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    version: import("zod").ZodOptional<import("zod").ZodString>;
    title: import("zod").ZodOptional<import("zod").ZodString>;
    content: import("zod").ZodOptional<import("zod").ZodString>;
    isRequired: import("zod").ZodOptional<import("zod").ZodBoolean>;
    effectiveAt: import("zod").ZodOptional<import("zod").ZodISODateTime>;
}, import("zod/v4/core").$strip>>;
export declare class TermsUpdateDto extends TermsUpdateDto_base {
}
declare const TermsAdminListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    type: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly SERVICE: "SERVICE";
        readonly PRIVACY: "PRIVACY";
        readonly LOCATION: "LOCATION";
        readonly MARKETING: "MARKETING";
        readonly PRIVACY_AGENCY_APPLICATION: "PRIVACY_AGENCY_APPLICATION";
        readonly PRIVACY_AGENCY_JOIN: "PRIVACY_AGENCY_JOIN";
        readonly DEAL_REQUEST_PRIVACY: "DEAL_REQUEST_PRIVACY";
        readonly DEAL_REQUEST_PROVIDE: "DEAL_REQUEST_PROVIDE";
    }>>;
    published: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>;
}, import("zod/v4/core").$strip>>;
export declare class TermsAdminListQueryDto extends TermsAdminListQueryDto_base {
}
declare const TermsPublishDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodPreprocess<import("zod").ZodObject<{
    urgent: import("zod").ZodDefault<import("zod").ZodBoolean>;
    reason: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>, unknown>>;
export declare class TermsPublishDto extends TermsPublishDto_base {
}
declare const SiteSettingKeyParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    key: import("zod").ZodEnum<{
        readonly BUSINESS_INFO: "BUSINESS_INFO";
        readonly CONTACT: "CONTACT";
        readonly SEO: "SEO";
        readonly FEATURES: "FEATURES";
        readonly FOOTER: "FOOTER";
        readonly HOME_LAYOUT: "HOME_LAYOUT";
        readonly APP_LINKS: "APP_LINKS";
    }>;
}, import("zod/v4/core").$strip>>;
export declare class SiteSettingKeyParamDto extends SiteSettingKeyParamDto_base {
}
declare const MemberListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
    status: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly ACTIVE: "ACTIVE";
        readonly SUSPENDED: "SUSPENDED";
        readonly WITHDRAWN: "WITHDRAWN";
    }>>;
    role: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly USER: "USER";
        readonly AGENT: "AGENT";
        readonly AGENCY_OWNER: "AGENCY_OWNER";
    }>>;
}, import("zod/v4/core").$strip>>;
export declare class MemberListQueryDto extends MemberListQueryDto_base {
}
declare const MemberSuspendDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    reason: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class MemberSuspendDto extends MemberSuspendDto_base {
}
declare const AdminAccountCreateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    email: import("zod").ZodPipe<import("zod").ZodEmail, import("zod").ZodTransform<string, string>>;
    name: import("zod").ZodString;
    role: import("zod").ZodEnum<{
        readonly OPERATOR: "OPERATOR";
        readonly ADMIN: "ADMIN";
        readonly SUPER_ADMIN: "SUPER_ADMIN";
    }>;
    password: import("zod").ZodString;
    ipAllowlist: import("zod").ZodDefault<import("zod").ZodArray<import("zod").ZodString>>;
}, import("zod/v4/core").$strip>>;
export declare class AdminAccountCreateDto extends AdminAccountCreateDto_base {
}
declare const AdminAccountUpdateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    name: import("zod").ZodOptional<import("zod").ZodString>;
    role: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly OPERATOR: "OPERATOR";
        readonly ADMIN: "ADMIN";
        readonly SUPER_ADMIN: "SUPER_ADMIN";
    }>>;
    status: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly ACTIVE: "ACTIVE";
        readonly DISABLED: "DISABLED";
    }>>;
    ipAllowlist: import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodString>>;
}, import("zod/v4/core").$strip>>;
export declare class AdminAccountUpdateDto extends AdminAccountUpdateDto_base {
}
declare const AdminAccountListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
    role: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly OPERATOR: "OPERATOR";
        readonly ADMIN: "ADMIN";
        readonly SUPER_ADMIN: "SUPER_ADMIN";
    }>>;
    status: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly ACTIVE: "ACTIVE";
        readonly DISABLED: "DISABLED";
    }>>;
}, import("zod/v4/core").$strip>>;
export declare class AdminAccountListQueryDto extends AdminAccountListQueryDto_base {
}
declare const AdminPasswordResetDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    password: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class AdminPasswordResetDto extends AdminPasswordResetDto_base {
}
declare const AdminListingListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    status: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly DRAFT: "DRAFT";
        readonly ACTIVE: "ACTIVE";
        readonly RESERVED: "RESERVED";
        readonly CLOSED: "CLOSED";
        readonly HIDDEN: "HIDDEN";
    }>>;
    dealType: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly SALE: "SALE";
        readonly JEONSE: "JEONSE";
        readonly MONTHLY: "MONTHLY";
        readonly PRESALE: "PRESALE";
    }>>;
    assetType: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>;
    agencyId: import("zod").ZodOptional<import("zod").ZodUUID>;
    complexId: import("zod").ZodOptional<import("zod").ZodUUID>;
    q: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class AdminListingListQueryDto extends AdminListingListQueryDto_base {
}
declare const AdminListingModerationDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    reason: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class AdminListingModerationDto extends AdminListingModerationDto_base {
}
declare const AuditLogQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    action: import("zod").ZodOptional<import("zod").ZodString>;
    actorType: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly ADMIN: "ADMIN";
        readonly USER: "USER";
        readonly SYSTEM: "SYSTEM";
    }>>;
    resourceType: import("zod").ZodOptional<import("zod").ZodString>;
    resourceId: import("zod").ZodOptional<import("zod").ZodString>;
    adminUserId: import("zod").ZodOptional<import("zod").ZodUUID>;
    from: import("zod").ZodOptional<import("zod").ZodISODateTime>;
    to: import("zod").ZodOptional<import("zod").ZodISODateTime>;
}, import("zod/v4/core").$strip>>;
export declare class AuditLogQueryDto extends AuditLogQueryDto_base {
}
declare const AdminSearchQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    q: import("zod").ZodString;
    limit: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
}, import("zod/v4/core").$strip>>;
export declare class AdminSearchQueryDto extends AdminSearchQueryDto_base {
}
declare const AdminNotificationListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    cursor: import("zod").ZodOptional<import("zod").ZodString>;
    limit: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    unreadOnly: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>;
}, import("zod/v4/core").$strip>>;
export declare class AdminNotificationListQueryDto extends AdminNotificationListQueryDto_base {
}
declare const StatsQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    days: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown> & import("zod").ZodType<7 | 90 | 30, unknown, import("zod/v4/core").$ZodTypeInternals<7 | 90 | 30, unknown>>>;
}, import("zod/v4/core").$strip>>;
export declare class StatsQueryDto extends StatsQueryDto_base {
}
declare const StatsSectionParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    section: import("zod").ZodEnum<{
        listings: "listings";
        ads: "ads";
        "deal-requests": "deal-requests";
        traffic: "traffic";
    }>;
}, import("zod/v4/core").$strip>>;
export declare class StatsSectionParamDto extends StatsSectionParamDto_base {
}
declare const VideoOrderDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    ids: import("zod").ZodArray<import("zod").ZodUUID>;
}, import("zod/v4/core").$strip>>;
/** PUT /admin/videos/order `{ ids }` — same rules as the FAQ order (uuids, unique, ≤ 500). */
export declare class VideoOrderDto extends VideoOrderDto_base {
}
export {};
