import { z } from 'zod';
declare const IdParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    id: z.ZodUUID;
}, z.core.$strip>>;
export declare class IdParamDto extends IdParamDto_base {
}
declare const AreaTypeParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    id: z.ZodUUID;
    areaTypeId: z.ZodUUID;
}, z.core.$strip>>;
export declare class AreaTypeParamDto extends AreaTypeParamDto_base {
}
declare const RegionCodeParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    code: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strip>>;
export declare class RegionCodeParamDto extends RegionCodeParamDto_base {
}
declare const PaginationQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class PaginationQueryDto extends PaginationQueryDto_base {
}
declare const ComplexSearchQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    q: z.ZodOptional<z.ZodString>;
    emdCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    assetType: z.ZodOptional<z.ZodEnum<{
        APT: "APT";
        OFFICETEL: "OFFICETEL";
    }>>;
    sort: z.ZodDefault<z.ZodEnum<{
        relevance: "relevance";
        name: "name";
        popular: "popular";
        households: "households";
        newest: "newest";
    }>>;
}, z.core.$strip>>;
export declare class ComplexSearchQueryDto extends ComplexSearchQueryDto_base {
}
declare const ComplexAutocompleteQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    q: z.ZodString;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class ComplexAutocompleteQueryDto extends ComplexAutocompleteQueryDto_base {
}
declare const ComplexTradesQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    dealType: z.ZodOptional<z.ZodEnum<{
        readonly SALE: "SALE";
        readonly JEONSE: "JEONSE";
        readonly MONTHLY: "MONTHLY";
    }>>;
    areaTypeId: z.ZodOptional<z.ZodUUID>;
    fromYm: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    toYm: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    includeCancelled: z.ZodDefault<z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>>;
}, z.core.$strip>>;
export declare class ComplexTradesQueryDto extends ComplexTradesQueryDto_base {
}
declare const ComplexStatsQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    dealType: z.ZodDefault<z.ZodEnum<{
        readonly SALE: "SALE";
        readonly JEONSE: "JEONSE";
        readonly MONTHLY: "MONTHLY";
    }>>;
    areaTypeId: z.ZodOptional<z.ZodUUID>;
    months: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class ComplexStatsQueryDto extends ComplexStatsQueryDto_base {
}
declare const PopularComplexesQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    emdCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
}, z.core.$strip>>;
export declare class PopularComplexesQueryDto extends PopularComplexesQueryDto_base {
}
declare const RegionListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    parentCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    level: z.ZodOptional<z.ZodEnum<{
        readonly SIDO: "SIDO";
        readonly SGG: "SGG";
        readonly EMD: "EMD";
        readonly RI: "RI";
    }>>;
    includeInactive: z.ZodDefault<z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>>;
}, z.core.$strip>>;
export declare class RegionListQueryDto extends RegionListQueryDto_base {
}
declare const AdminComplexListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    q: z.ZodOptional<z.ZodString>;
    emdCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    includeDeleted: z.ZodDefault<z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>>;
    missingExternalCode: z.ZodDefault<z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>>;
}, z.core.$strip>>;
export declare class AdminComplexListQueryDto extends AdminComplexListQueryDto_base {
}
declare const CreateComplexDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    areaTypes: z.ZodDefault<z.ZodArray<z.ZodObject<{
        exclusiveArea: z.ZodNumber;
        supplyArea: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
        typeName: z.ZodDefault<z.ZodString>;
        pyeongLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        households: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
        rooms: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
        baths: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    }, z.core.$strip>>>;
    name: z.ZodString;
    assetType: z.ZodDefault<z.ZodEnum<{
        APT: "APT";
        OFFICETEL: "OFFICETEL";
    }>>;
    roadAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jibunAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    emdCode: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    emdName: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    jibun: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    lat: z.ZodNumber;
    lng: z.ZodNumber;
    households: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    buildings: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    floorsMin: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    floorsMax: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    approvalDate: z.ZodOptional<z.ZodNullable<z.ZodISODate>>;
    builtYear: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    parkingTotal: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    parkingPerHousehold: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    floorAreaRatio: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    buildingCoverageRatio: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    heatingType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    builder: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    externalCode: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
}, z.core.$strip>>;
export declare class CreateComplexDto extends CreateComplexDto_base {
}
declare const UpdateComplexDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    roadAddress: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    jibunAddress: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    emdCode: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>>;
    emdName: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    jibun: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    lat: z.ZodOptional<z.ZodNumber>;
    lng: z.ZodOptional<z.ZodNumber>;
    households: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
    buildings: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
    floorsMin: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
    floorsMax: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
    approvalDate: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodISODate>>>;
    builtYear: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
    parkingTotal: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
    parkingPerHousehold: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    floorAreaRatio: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    buildingCoverageRatio: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    heatingType: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    builder: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    externalCode: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>>;
    assetType: z.ZodOptional<z.ZodEnum<{
        APT: "APT";
        OFFICETEL: "OFFICETEL";
    }>>;
}, z.core.$strip>>;
export declare class UpdateComplexDto extends UpdateComplexDto_base {
}
declare const CreateAreaTypeDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    exclusiveArea: z.ZodNumber;
    supplyArea: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    typeName: z.ZodDefault<z.ZodString>;
    pyeongLabel: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    households: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    rooms: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
    baths: z.ZodOptional<z.ZodNullable<z.ZodInt>>;
}, z.core.$strip>>;
export declare class CreateAreaTypeDto extends CreateAreaTypeDto_base {
}
declare const UpdateAreaTypeDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    exclusiveArea: z.ZodOptional<z.ZodNumber>;
    supplyArea: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodNumber>>>;
    pyeongLabel: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodString>>>;
    households: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
    rooms: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
    baths: z.ZodOptional<z.ZodOptional<z.ZodNullable<z.ZodInt>>>;
    typeName: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare class UpdateAreaTypeDto extends UpdateAreaTypeDto_base {
}
declare const ComplexPhotosDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    items: z.ZodArray<z.ZodObject<{
        mediaId: z.ZodUUID;
        caption: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
export declare class ComplexPhotosDto extends ComplexPhotosDto_base {
}
declare const TradeSyncRequestDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    yearMonth: z.ZodCoercedNumber<unknown>;
    kinds: z.ZodPipe<z.ZodDefault<z.ZodArray<z.ZodEnum<{
        readonly APT_TRADE: "APT_TRADE";
        readonly APT_RENT: "APT_RENT";
    }>>>, z.ZodTransform<("APT_TRADE" | "APT_RENT")[], ("APT_TRADE" | "APT_RENT")[]>>;
}, z.core.$strip>>;
export declare class TradeSyncRequestDto extends TradeSyncRequestDto_base {
}
declare const TradeSyncRunsQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    kind: z.ZodOptional<z.ZodEnum<{
        readonly APT_TRADE: "APT_TRADE";
        readonly APT_RENT: "APT_RENT";
    }>>;
    status: z.ZodOptional<z.ZodEnum<{
        readonly RUNNING: "RUNNING";
        readonly SUCCEEDED: "SUCCEEDED";
        readonly FAILED: "FAILED";
    }>>;
    yearMonth: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class TradeSyncRunsQueryDto extends TradeSyncRunsQueryDto_base {
}
declare const TradeRematchRequestDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    fromYm: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class TradeRematchRequestDto extends TradeRematchRequestDto_base {
}
declare const TradeSyncJobParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    jobId: z.ZodString;
}, z.core.$strip>>;
export declare class TradeSyncJobParamDto extends TradeSyncJobParamDto_base {
}
declare const RegionUpsertDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    name: z.ZodString;
    fullName: z.ZodString;
    level: z.ZodEnum<{
        readonly SIDO: "SIDO";
        readonly SGG: "SGG";
        readonly EMD: "EMD";
        readonly RI: "RI";
    }>;
    parentCode: z.ZodOptional<z.ZodNullable<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>;
    lat: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    lng: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    isActive: z.ZodDefault<z.ZodBoolean>;
    sortOrder: z.ZodDefault<z.ZodInt>;
}, z.core.$strip>>;
export declare class RegionUpsertDto extends RegionUpsertDto_base {
}
/** Integer query param clamped into [min, max]; missing / not a number → `fallback` (like the web mock). */
export declare const clampedInt: (min: number, max: number, fallback: number) => z.ZodPreprocess<z.ZodNumber, unknown>;
/** GET /complexes/:id/nearby?limit&radius (radius in metres). */
export declare const complexNearbyQuerySchema: z.ZodObject<{
    limit: z.ZodPreprocess<z.ZodNumber, unknown>;
    radius: z.ZodPreprocess<z.ZodNumber, unknown>;
}, z.core.$strip>;
declare const ComplexNearbyQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    limit: z.ZodPreprocess<z.ZodNumber, unknown>;
    radius: z.ZodPreprocess<z.ZodNumber, unknown>;
}, z.core.$strip>>;
export declare class ComplexNearbyQueryDto extends ComplexNearbyQueryDto_base {
}
/** GET /complexes/:id/agencies?limit */
export declare const complexAgenciesQuerySchema: z.ZodObject<{
    limit: z.ZodPreprocess<z.ZodNumber, unknown>;
}, z.core.$strip>;
declare const ComplexAgenciesQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    limit: z.ZodPreprocess<z.ZodNumber, unknown>;
}, z.core.$strip>>;
export declare class ComplexAgenciesQueryDto extends ComplexAgenciesQueryDto_base {
}
export {};
