declare const IdParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    id: import("zod").ZodUUID;
}, import("zod/v4/core").$strip>>;
export declare class IdParamDto extends IdParamDto_base {
}
declare const MediaUploadQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    purpose: import("zod").ZodEnum<{
        readonly LISTING_PHOTO: "LISTING_PHOTO";
        readonly COMPLEX_PHOTO: "COMPLEX_PHOTO";
        readonly DEAL_REQUEST_PHOTO: "DEAL_REQUEST_PHOTO";
        readonly AGENCY_LOGO: "AGENCY_LOGO";
        readonly AGENCY_COVER: "AGENCY_COVER";
        readonly AGENCY_DOCUMENT: "AGENCY_DOCUMENT";
        readonly BANNER: "BANNER";
        readonly POPUP: "POPUP";
        readonly CONTENT: "CONTENT";
        readonly PROFILE: "PROFILE";
    }>;
}, import("zod/v4/core").$strip>>;
export declare class MediaUploadQueryDto extends MediaUploadQueryDto_base {
}
declare const MyMediaListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    purpose: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly LISTING_PHOTO: "LISTING_PHOTO";
        readonly COMPLEX_PHOTO: "COMPLEX_PHOTO";
        readonly DEAL_REQUEST_PHOTO: "DEAL_REQUEST_PHOTO";
        readonly AGENCY_LOGO: "AGENCY_LOGO";
        readonly AGENCY_COVER: "AGENCY_COVER";
        readonly AGENCY_DOCUMENT: "AGENCY_DOCUMENT";
        readonly BANNER: "BANNER";
        readonly POPUP: "POPUP";
        readonly CONTENT: "CONTENT";
        readonly PROFILE: "PROFILE";
    }>>>, unknown>;
    status: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly PENDING: "PENDING";
        readonly READY: "READY";
        readonly FAILED: "FAILED";
    }>>>, unknown>;
}, import("zod/v4/core").$strip>>;
export declare class MyMediaListQueryDto extends MyMediaListQueryDto_base {
}
declare const AdminMediaListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    page: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    pageSize: import("zod").ZodDefault<import("zod").ZodCoercedNumber<unknown>>;
    purpose: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly LISTING_PHOTO: "LISTING_PHOTO";
        readonly COMPLEX_PHOTO: "COMPLEX_PHOTO";
        readonly DEAL_REQUEST_PHOTO: "DEAL_REQUEST_PHOTO";
        readonly AGENCY_LOGO: "AGENCY_LOGO";
        readonly AGENCY_COVER: "AGENCY_COVER";
        readonly AGENCY_DOCUMENT: "AGENCY_DOCUMENT";
        readonly BANNER: "BANNER";
        readonly POPUP: "POPUP";
        readonly CONTENT: "CONTENT";
        readonly PROFILE: "PROFILE";
    }>>>, unknown>;
    status: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodArray<import("zod").ZodEnum<{
        readonly PENDING: "PENDING";
        readonly READY: "READY";
        readonly FAILED: "FAILED";
    }>>>, unknown>;
    visibility: import("zod").ZodOptional<import("zod").ZodEnum<{
        readonly PUBLIC: "PUBLIC";
        readonly PRIVATE: "PRIVATE";
    }>>;
    ownerUserId: import("zod").ZodOptional<import("zod").ZodUUID>;
    ownerAdminId: import("zod").ZodOptional<import("zod").ZodUUID>;
    orphaned: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>;
    includeDeleted: import("zod").ZodPreprocess<import("zod").ZodOptional<import("zod").ZodBoolean>, unknown>;
}, import("zod/v4/core").$strip>>;
export declare class AdminMediaListQueryDto extends AdminMediaListQueryDto_base {
}
export {};
