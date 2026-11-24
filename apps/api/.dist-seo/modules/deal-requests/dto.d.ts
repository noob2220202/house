import { z } from 'zod';
declare const IdParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    id: z.ZodUUID;
}, z.core.$strip>>;
export declare class IdParamDto extends IdParamDto_base {
}
declare const MyDealRequestListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    status: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly OPEN: "OPEN";
        readonly MATCHED: "MATCHED";
        readonly CLOSED: "CLOSED";
        readonly CANCELLED: "CANCELLED";
        readonly EXPIRED: "EXPIRED";
    }>>>, unknown>;
    type: z.ZodOptional<z.ZodEnum<{
        readonly SELL_OR_LEASE: "SELL_OR_LEASE";
        readonly WANTED: "WANTED";
    }>>;
}, z.core.$strip>>;
export declare class MyDealRequestListQueryDto extends MyDealRequestListQueryDto_base {
}
declare const DealRequestCloseDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodPipe<z.ZodOptional<z.ZodObject<{
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>, z.ZodTransform<{
    reason?: string | undefined;
}, {
    reason?: string | undefined;
} | undefined>>>;
export declare class DealRequestCloseDto extends DealRequestCloseDto_base {
}
declare const ContactGrantDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    agencyId: z.ZodUUID;
}, z.core.$strip>>;
export declare class ContactGrantDto extends ContactGrantDto_base {
}
declare const ContactGrantParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    id: z.ZodUUID;
    agencyId: z.ZodUUID;
}, z.core.$strip>>;
export declare class ContactGrantParamDto extends ContactGrantParamDto_base {
}
declare const ProposalCreateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    message: z.ZodString;
    listingIds: z.ZodDefault<z.ZodArray<z.ZodUUID>>;
    suggestedPrice: z.ZodOptional<z.ZodInt>;
    suggestedDeposit: z.ZodOptional<z.ZodInt>;
    suggestedMonthlyRent: z.ZodOptional<z.ZodInt>;
}, z.core.$strip>>;
export declare class ProposalCreateDto extends ProposalCreateDto_base {
}
declare const ProposalAcceptDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    shareContact: z.ZodBoolean;
}, z.core.$strip>>;
export declare class ProposalAcceptDto extends ProposalAcceptDto_base {
}
declare const AgencyDealRequestListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    scope: z.ZodDefault<z.ZodEnum<{
        readonly ALL: "ALL";
        readonly TARGETED: "TARGETED";
        readonly PROPOSED: "PROPOSED";
        readonly NEW: "NEW";
    }>>;
    type: z.ZodOptional<z.ZodEnum<{
        readonly SELL_OR_LEASE: "SELL_OR_LEASE";
        readonly WANTED: "WANTED";
    }>>;
    assetType: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
    dealType: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly SALE: "SALE";
        readonly JEONSE: "JEONSE";
        readonly MONTHLY: "MONTHLY";
        readonly PRESALE: "PRESALE";
    }>>>, unknown>;
}, z.core.$strip>>;
export declare class AgencyDealRequestListQueryDto extends AgencyDealRequestListQueryDto_base {
}
declare const AgencyProposalListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    status: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly SENT: "SENT";
        readonly VIEWED: "VIEWED";
        readonly ACCEPTED: "ACCEPTED";
        readonly DECLINED: "DECLINED";
        readonly WITHDRAWN: "WITHDRAWN";
    }>>>, unknown>;
}, z.core.$strip>>;
export declare class AgencyProposalListQueryDto extends AgencyProposalListQueryDto_base {
}
declare const NotificationFeedQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    unreadOnly: z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>;
    scope: z.ZodOptional<z.ZodEnum<{
        agency: "agency";
        personal: "personal";
    }>>;
}, z.core.$strip>>;
export declare class NotificationFeedQueryDto extends NotificationFeedQueryDto_base {
}
declare const NotificationScopeQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    scope: z.ZodOptional<z.ZodEnum<{
        agency: "agency";
        personal: "personal";
    }>>;
}, z.core.$strip>>;
export declare class NotificationScopeQueryDto extends NotificationScopeQueryDto_base {
}
declare const NotificationReadDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    ids: z.ZodOptional<z.ZodArray<z.ZodUUID>>;
    all: z.ZodOptional<z.ZodLiteral<true>>;
}, z.core.$strip>>;
export declare class NotificationReadDto extends NotificationReadDto_base {
}
/**
 * Admin list: shared query + `spam=flagged` (flagged requests) | `spam=suspected` (unflagged OPEN
 * requests with automatic abuse signals — none exist yet, so always empty) as the admin mock has.
 * Local until shared has it.
 */
export declare const adminDealRequestListQueryWithSpamSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    status: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly OPEN: "OPEN";
        readonly MATCHED: "MATCHED";
        readonly CLOSED: "CLOSED";
        readonly CANCELLED: "CANCELLED";
        readonly EXPIRED: "EXPIRED";
    }>>>, unknown>;
    type: z.ZodOptional<z.ZodEnum<{
        readonly SELL_OR_LEASE: "SELL_OR_LEASE";
        readonly WANTED: "WANTED";
    }>>;
    assetType: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
    userId: z.ZodOptional<z.ZodUUID>;
    agencyId: z.ZodOptional<z.ZodUUID>;
    spam: z.ZodOptional<z.ZodEnum<{
        flagged: "flagged";
        suspected: "suspected";
    }>>;
}, z.core.$strip>;
export type AdminDealRequestListQueryWithSpam = z.infer<typeof adminDealRequestListQueryWithSpamSchema>;
declare const AdminDealRequestListQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    status: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly OPEN: "OPEN";
        readonly MATCHED: "MATCHED";
        readonly CLOSED: "CLOSED";
        readonly CANCELLED: "CANCELLED";
        readonly EXPIRED: "EXPIRED";
    }>>>, unknown>;
    type: z.ZodOptional<z.ZodEnum<{
        readonly SELL_OR_LEASE: "SELL_OR_LEASE";
        readonly WANTED: "WANTED";
    }>>;
    assetType: z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodEnum<{
        readonly APT: "APT";
        readonly OFFICETEL: "OFFICETEL";
        readonly ONEROOM: "ONEROOM";
        readonly HOUSE: "HOUSE";
        readonly COMMERCIAL: "COMMERCIAL";
        readonly LAND: "LAND";
    }>>>, unknown>;
    userId: z.ZodOptional<z.ZodUUID>;
    agencyId: z.ZodOptional<z.ZodUUID>;
    spam: z.ZodOptional<z.ZodEnum<{
        flagged: "flagged";
        suspected: "suspected";
    }>>;
}, z.core.$strip>>;
export declare class AdminDealRequestListQueryDto extends AdminDealRequestListQueryDto_base {
}
declare const AdminDealRequestCloseDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    reason: z.ZodString;
}, z.core.$strip>>;
export declare class AdminDealRequestCloseDto extends AdminDealRequestCloseDto_base {
}
/** Shortest reason accepted when flagging (admin mock: "사유를 5자 이상 입력해 주세요."). */
export declare const SPAM_REASON_MIN = 5;
export declare const SPAM_REASON_MAX = 500;
/**
 * POST /admin/deal-requests/:id/spam-flag — `{ flagged, reason? }` (admin `flagDealRequestSpam`).
 * `reason` is required (≥ 5 chars) when flagging, optional when clearing. Local until shared has it.
 */
export declare const adminDealRequestSpamFlagSchema: z.ZodObject<{
    flagged: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type AdminDealRequestSpamFlagInput = z.infer<typeof adminDealRequestSpamFlagSchema>;
declare const AdminDealRequestSpamFlagDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    flagged: z.ZodBoolean;
    reason: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare class AdminDealRequestSpamFlagDto extends AdminDealRequestSpamFlagDto_base {
}
/**
 * GET /deal-requests/target-agencies?q&emdCode&regionCodes&page&pageSize — agencies a request for
 * the area reaches (web `TargetAgencyQuery`). Local until shared has it.
 */
export declare const targetAgencyQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    q: z.ZodOptional<z.ZodString>;
    emdCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    regionCodes: z.ZodPipe<z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>, unknown>, z.ZodOptional<z.ZodArray<z.ZodString>>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type TargetAgencyQuery = z.infer<typeof targetAgencyQuerySchema>;
declare const TargetAgencyQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    q: z.ZodOptional<z.ZodString>;
    emdCode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
    regionCodes: z.ZodPipe<z.ZodPreprocess<z.ZodOptional<z.ZodArray<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>>, unknown>, z.ZodOptional<z.ZodArray<z.ZodString>>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class TargetAgencyQueryDto extends TargetAgencyQueryDto_base {
}
/** GET /deal-requests/address-match?roadAddress&buildingName&bcode (Kakao postcode result). */
export declare const addressMatchQuerySchema: z.ZodObject<{
    roadAddress: z.ZodString;
    buildingName: z.ZodOptional<z.ZodString>;
    bcode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
}, z.core.$strip>;
export type AddressMatchQuery = z.infer<typeof addressMatchQuerySchema>;
declare const AddressMatchQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    roadAddress: z.ZodString;
    buildingName: z.ZodOptional<z.ZodString>;
    bcode: z.ZodOptional<z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>>;
}, z.core.$strip>>;
export declare class AddressMatchQueryDto extends AddressMatchQueryDto_base {
}
/** GET /agency/deal-requests/:id/listing-candidates?q&page&pageSize */
export declare const listingCandidateQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    q: z.ZodOptional<z.ZodString>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type ListingCandidateQuery = z.infer<typeof listingCandidateQuerySchema>;
declare const ListingCandidateQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    q: z.ZodOptional<z.ZodString>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>>;
export declare class ListingCandidateQueryDto extends ListingCandidateQueryDto_base {
}
export {};
