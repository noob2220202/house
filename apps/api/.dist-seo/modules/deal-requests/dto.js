"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingCandidateQueryDto = exports.listingCandidateQuerySchema = exports.AddressMatchQueryDto = exports.addressMatchQuerySchema = exports.TargetAgencyQueryDto = exports.targetAgencyQuerySchema = exports.AdminDealRequestSpamFlagDto = exports.adminDealRequestSpamFlagSchema = exports.SPAM_REASON_MAX = exports.SPAM_REASON_MIN = exports.AdminDealRequestCloseDto = exports.AdminDealRequestListQueryDto = exports.adminDealRequestListQueryWithSpamSchema = exports.NotificationReadDto = exports.NotificationScopeQueryDto = exports.NotificationFeedQueryDto = exports.AgencyProposalListQueryDto = exports.AgencyDealRequestListQueryDto = exports.ProposalAcceptDto = exports.ProposalCreateDto = exports.ContactGrantParamDto = exports.ContactGrantDto = exports.DealRequestCloseDto = exports.MyDealRequestListQueryDto = exports.IdParamDto = void 0;
const shared_1 = require("@house/shared");
const zod_1 = require("zod");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const notification_scope_1 = require("./notifications/notification-scope");
class IdParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.idParamSchema) {
}
exports.IdParamDto = IdParamDto;
class MyDealRequestListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.myDealRequestListQuerySchema) {
}
exports.MyDealRequestListQueryDto = MyDealRequestListQueryDto;
class DealRequestCloseDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.dealRequestCloseSchema) {
}
exports.DealRequestCloseDto = DealRequestCloseDto;
class ContactGrantDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.contactGrantSchema) {
}
exports.ContactGrantDto = ContactGrantDto;
class ContactGrantParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.contactGrantParamSchema) {
}
exports.ContactGrantParamDto = ContactGrantParamDto;
class ProposalCreateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.proposalCreateSchema) {
}
exports.ProposalCreateDto = ProposalCreateDto;
class ProposalAcceptDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.proposalAcceptSchema) {
}
exports.ProposalAcceptDto = ProposalAcceptDto;
class AgencyDealRequestListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyDealRequestListQuerySchema) {
}
exports.AgencyDealRequestListQueryDto = AgencyDealRequestListQueryDto;
class AgencyProposalListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyProposalListQuerySchema) {
}
exports.AgencyProposalListQueryDto = AgencyProposalListQueryDto;
class NotificationFeedQueryDto extends (0, zod_validation_pipe_1.createZodDto)(notification_scope_1.notificationFeedQuerySchema) {
}
exports.NotificationFeedQueryDto = NotificationFeedQueryDto;
class NotificationScopeQueryDto extends (0, zod_validation_pipe_1.createZodDto)(notification_scope_1.notificationScopeQuerySchema) {
}
exports.NotificationScopeQueryDto = NotificationScopeQueryDto;
class NotificationReadDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.notificationReadSchema) {
}
exports.NotificationReadDto = NotificationReadDto;
/**
 * Admin list: shared query + `spam=flagged` (flagged requests) | `spam=suspected` (unflagged OPEN
 * requests with automatic abuse signals — none exist yet, so always empty) as the admin mock has.
 * Local until shared has it.
 */
exports.adminDealRequestListQueryWithSpamSchema = shared_1.adminDealRequestListQuerySchema.extend({
    spam: zod_1.z.enum(['flagged', 'suspected']).optional(),
});
class AdminDealRequestListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.adminDealRequestListQueryWithSpamSchema) {
}
exports.AdminDealRequestListQueryDto = AdminDealRequestListQueryDto;
class AdminDealRequestCloseDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminDealRequestCloseSchema) {
}
exports.AdminDealRequestCloseDto = AdminDealRequestCloseDto;
/** Shortest reason accepted when flagging (admin mock: "사유를 5자 이상 입력해 주세요."). */
exports.SPAM_REASON_MIN = 5;
exports.SPAM_REASON_MAX = 500;
/**
 * POST /admin/deal-requests/:id/spam-flag — `{ flagged, reason? }` (admin `flagDealRequestSpam`).
 * `reason` is required (≥ 5 chars) when flagging, optional when clearing. Local until shared has it.
 */
exports.adminDealRequestSpamFlagSchema = zod_1.z
    .object({
    flagged: zod_1.z.boolean({ message: '표시 여부가 올바르지 않습니다.' }),
    reason: zod_1.z.string().trim().max(exports.SPAM_REASON_MAX).optional(),
})
    .superRefine((v, ctx) => {
    if (v.flagged && (v.reason ?? '').length < exports.SPAM_REASON_MIN) {
        ctx.addIssue({
            code: 'custom',
            path: ['reason'],
            message: `사유를 ${exports.SPAM_REASON_MIN}자 이상 입력해 주세요.`,
        });
    }
});
class AdminDealRequestSpamFlagDto extends (0, zod_validation_pipe_1.createZodDto)(exports.adminDealRequestSpamFlagSchema) {
}
exports.AdminDealRequestSpamFlagDto = AdminDealRequestSpamFlagDto;
/**
 * The create body is a discriminated union (내놓기 | 구하기), which a class cannot extend, so the
 * controller validates it with an explicit `new ZodValidationPipe(dealRequestCreateSchema)`.
 */
/** Search text of the pickers (상호 / 대표 / 주소, 매물 제목 / 단지명). */
const searchText = zod_1.z.string().trim().max(50).optional();
/**
 * GET /deal-requests/target-agencies?q&emdCode&regionCodes&page&pageSize — agencies a request for
 * the area reaches (web `TargetAgencyQuery`). Local until shared has it.
 */
exports.targetAgencyQuerySchema = shared_1.paginationQuerySchema.extend({
    q: searchText,
    emdCode: shared_1.regionCodeSchema.optional(),
    regionCodes: (0, shared_1.csvArray)(shared_1.regionCodeSchema).pipe(zod_1.z.array(zod_1.z.string()).max(shared_1.DEAL_REQUEST_LIMITS.MAX_REGION_CODES).optional()),
    pageSize: zod_1.z.coerce.number().int().min(1).max(50).default(10),
});
class TargetAgencyQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.targetAgencyQuerySchema) {
}
exports.TargetAgencyQueryDto = TargetAgencyQueryDto;
/** GET /deal-requests/address-match?roadAddress&buildingName&bcode (Kakao postcode result). */
exports.addressMatchQuerySchema = zod_1.z.object({
    roadAddress: zod_1.z.string().trim().min(1, '주소를 입력해 주세요.').max(200),
    buildingName: zod_1.z.string().trim().max(100).optional(),
    bcode: shared_1.regionCodeSchema.optional(),
});
class AddressMatchQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.addressMatchQuerySchema) {
}
exports.AddressMatchQueryDto = AddressMatchQueryDto;
/** GET /agency/deal-requests/:id/listing-candidates?q&page&pageSize */
exports.listingCandidateQuerySchema = shared_1.paginationQuerySchema.extend({
    q: searchText,
    pageSize: zod_1.z.coerce.number().int().min(1).max(100).default(50),
});
class ListingCandidateQueryDto extends (0, zod_validation_pipe_1.createZodDto)(exports.listingCandidateQuerySchema) {
}
exports.ListingCandidateQueryDto = ListingCandidateQueryDto;
//# sourceMappingURL=dto.js.map