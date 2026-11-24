"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoOrderDto = exports.StatsSectionParamDto = exports.StatsQueryDto = exports.AdminNotificationListQueryDto = exports.AdminSearchQueryDto = exports.AuditLogQueryDto = exports.AdminListingModerationDto = exports.AdminListingListQueryDto = exports.AdminPasswordResetDto = exports.AdminAccountListQueryDto = exports.AdminAccountUpdateDto = exports.AdminAccountCreateDto = exports.MemberSuspendDto = exports.MemberListQueryDto = exports.SiteSettingKeyParamDto = exports.TermsPublishDto = exports.TermsAdminListQueryDto = exports.TermsUpdateDto = exports.TermsInputDto = exports.LocalVideoAdminListQueryDto = exports.LocalVideoListQueryDto = exports.LocalVideoUpdateDto = exports.LocalVideoInputDto = exports.FaqAdminListQueryDto = exports.FaqListQueryDto = exports.FaqOrderDto = exports.FaqUpdateDto = exports.FaqInputDto = exports.NoticeAdminListQueryDto = exports.NoticeUpdateDto = exports.NoticeInputDto = exports.ReportResolveDto = exports.ReportReviewDto = exports.ReportListQueryDto = exports.ReportCreateDto = exports.PaginationQueryDto = exports.IdParamDto = void 0;
const shared_1 = require("@house/shared");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
const schemas_1 = require("./schemas");
class IdParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.idParamSchema) {
}
exports.IdParamDto = IdParamDto;
class PaginationQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.paginationQuerySchema) {
}
exports.PaginationQueryDto = PaginationQueryDto;
class ReportCreateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.reportCreateSchema) {
}
exports.ReportCreateDto = ReportCreateDto;
class ReportListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.reportListQuerySchema) {
}
exports.ReportListQueryDto = ReportListQueryDto;
class ReportReviewDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.reportReviewSchema) {
}
exports.ReportReviewDto = ReportReviewDto;
class ReportResolveDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.reportResolveSchema) {
}
exports.ReportResolveDto = ReportResolveDto;
class NoticeInputDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.noticeInputSchema) {
}
exports.NoticeInputDto = NoticeInputDto;
class NoticeUpdateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.noticeUpdateSchema) {
}
exports.NoticeUpdateDto = NoticeUpdateDto;
class NoticeAdminListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.noticeAdminListQuerySchema) {
}
exports.NoticeAdminListQueryDto = NoticeAdminListQueryDto;
class FaqInputDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.faqInputSchema) {
}
exports.FaqInputDto = FaqInputDto;
class FaqUpdateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.faqUpdateSchema) {
}
exports.FaqUpdateDto = FaqUpdateDto;
class FaqOrderDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.faqOrderSchema) {
}
exports.FaqOrderDto = FaqOrderDto;
class FaqListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.faqListQuerySchema) {
}
exports.FaqListQueryDto = FaqListQueryDto;
class FaqAdminListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.faqAdminListQuerySchema) {
}
exports.FaqAdminListQueryDto = FaqAdminListQueryDto;
class LocalVideoInputDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.localVideoInputSchema) {
}
exports.LocalVideoInputDto = LocalVideoInputDto;
class LocalVideoUpdateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.localVideoUpdateSchema) {
}
exports.LocalVideoUpdateDto = LocalVideoUpdateDto;
class LocalVideoListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.localVideoListQuerySchema) {
}
exports.LocalVideoListQueryDto = LocalVideoListQueryDto;
class LocalVideoAdminListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.localVideoAdminListQuerySchema) {
}
exports.LocalVideoAdminListQueryDto = LocalVideoAdminListQueryDto;
class TermsInputDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.termsDocumentInputSchema) {
}
exports.TermsInputDto = TermsInputDto;
class TermsUpdateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.termsDocumentUpdateSchema) {
}
exports.TermsUpdateDto = TermsUpdateDto;
class TermsAdminListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.termsAdminListQuerySchema) {
}
exports.TermsAdminListQueryDto = TermsAdminListQueryDto;
class TermsPublishDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.termsPublishSchema) {
}
exports.TermsPublishDto = TermsPublishDto;
class SiteSettingKeyParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.siteSettingKeyParamSchema) {
}
exports.SiteSettingKeyParamDto = SiteSettingKeyParamDto;
class MemberListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.memberListQuerySchema) {
}
exports.MemberListQueryDto = MemberListQueryDto;
class MemberSuspendDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.memberSuspendSchema) {
}
exports.MemberSuspendDto = MemberSuspendDto;
class AdminAccountCreateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminAccountCreateSchema) {
}
exports.AdminAccountCreateDto = AdminAccountCreateDto;
class AdminAccountUpdateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminAccountUpdateSchema) {
}
exports.AdminAccountUpdateDto = AdminAccountUpdateDto;
class AdminAccountListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminAccountListQuerySchema) {
}
exports.AdminAccountListQueryDto = AdminAccountListQueryDto;
class AdminPasswordResetDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminPasswordResetSchema) {
}
exports.AdminPasswordResetDto = AdminPasswordResetDto;
class AdminListingListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminListingListQuerySchema) {
}
exports.AdminListingListQueryDto = AdminListingListQueryDto;
class AdminListingModerationDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminListingModerationSchema) {
}
exports.AdminListingModerationDto = AdminListingModerationDto;
class AuditLogQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.auditLogQuerySchema) {
}
exports.AuditLogQueryDto = AuditLogQueryDto;
// Module-local contracts (./schemas.ts) of the WI-10 back-office endpoints.
class AdminSearchQueryDto extends (0, zod_validation_pipe_1.createZodDto)(schemas_1.adminSearchQuerySchema) {
}
exports.AdminSearchQueryDto = AdminSearchQueryDto;
class AdminNotificationListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(schemas_1.adminNotificationListQuerySchema) {
}
exports.AdminNotificationListQueryDto = AdminNotificationListQueryDto;
class StatsQueryDto extends (0, zod_validation_pipe_1.createZodDto)(schemas_1.statsQuerySchema) {
}
exports.StatsQueryDto = StatsQueryDto;
class StatsSectionParamDto extends (0, zod_validation_pipe_1.createZodDto)(schemas_1.statsSectionParamSchema) {
}
exports.StatsSectionParamDto = StatsSectionParamDto;
/** PUT /admin/videos/order `{ ids }` — same rules as the FAQ order (uuids, unique, ≤ 500). */
class VideoOrderDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.faqOrderSchema) {
}
exports.VideoOrderDto = VideoOrderDto;
//# sourceMappingURL=dto.js.map