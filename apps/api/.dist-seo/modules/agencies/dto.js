"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencyRegistryCheckQueryDto = exports.AgencyLocationUpdateDto = exports.AdminAgencyDetailQueryDto = exports.AgencyAdminDeleteDto = exports.AgencyDecisionDto = exports.AdminAgencyListQueryDto = exports.AgencyJoinDto = exports.AgencyInviteParamDto = exports.AgencyInviteCreateDto = exports.AgencyMemberUpdateDto = exports.AgencyMemberListQueryDto = exports.AgencyMemberParamDto = exports.AgencyAdminDocumentParamDto = exports.AgencyDocumentParamDto = exports.AgencyDocumentDto = exports.AgencyMapQueryDto = exports.AgencySearchQueryDto = exports.AgencyUpdateDto = exports.AgencyResubmitDto = exports.agencyResubmitWithConsentsSchema = exports.AgencyRegisterDto = exports.IdParamDto = void 0;
const shared_1 = require("@house/shared");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
class IdParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.idParamSchema) {
}
exports.IdParamDto = IdParamDto;
class AgencyRegisterDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyRegisterSchema) {
}
exports.AgencyRegisterDto = AgencyRegisterDto;
/**
 * Resubmission body: the shared schema plus optional D8 `consents` (local until the shared schema
 * has them). Sent → the current 개인정보 수집·이용 동의 version is required and recorded; omitted →
 * the application's consent still covers the resubmission.
 */
exports.agencyResubmitWithConsentsSchema = shared_1.agencyResubmitSchema.safeExtend({
    consents: (0, shared_1.actionConsentsSchema)(shared_1.ACTION_CONSENT_TERMS.AGENCY_APPLICATION),
});
class AgencyResubmitDto extends (0, zod_validation_pipe_1.createZodDto)(exports.agencyResubmitWithConsentsSchema) {
}
exports.AgencyResubmitDto = AgencyResubmitDto;
class AgencyUpdateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyUpdateSchema) {
}
exports.AgencyUpdateDto = AgencyUpdateDto;
class AgencySearchQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencySearchQuerySchema) {
}
exports.AgencySearchQueryDto = AgencySearchQueryDto;
class AgencyMapQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyMapQuerySchema) {
}
exports.AgencyMapQueryDto = AgencyMapQueryDto;
class AgencyDocumentDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyDocumentInputSchema) {
}
exports.AgencyDocumentDto = AgencyDocumentDto;
class AgencyDocumentParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyDocumentParamSchema) {
}
exports.AgencyDocumentParamDto = AgencyDocumentParamDto;
class AgencyAdminDocumentParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyAdminDocumentParamSchema) {
}
exports.AgencyAdminDocumentParamDto = AgencyAdminDocumentParamDto;
class AgencyMemberParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyMemberParamSchema) {
}
exports.AgencyMemberParamDto = AgencyMemberParamDto;
class AgencyMemberListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyMemberListQuerySchema) {
}
exports.AgencyMemberListQueryDto = AgencyMemberListQueryDto;
class AgencyMemberUpdateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyMemberUpdateSchema) {
}
exports.AgencyMemberUpdateDto = AgencyMemberUpdateDto;
class AgencyInviteCreateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyInviteCreateSchema) {
}
exports.AgencyInviteCreateDto = AgencyInviteCreateDto;
class AgencyInviteParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyInviteParamSchema) {
}
exports.AgencyInviteParamDto = AgencyInviteParamDto;
class AgencyJoinDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyJoinSchema) {
}
exports.AgencyJoinDto = AgencyJoinDto;
class AdminAgencyListQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminAgencyListQuerySchema) {
}
exports.AdminAgencyListQueryDto = AdminAgencyListQueryDto;
class AgencyDecisionDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyDecisionSchema) {
}
exports.AgencyDecisionDto = AgencyDecisionDto;
class AgencyAdminDeleteDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyAdminDeleteSchema) {
}
exports.AgencyAdminDeleteDto = AgencyAdminDeleteDto;
class AdminAgencyDetailQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminAgencyDetailQuerySchema) {
}
exports.AdminAgencyDetailQueryDto = AdminAgencyDetailQueryDto;
class AgencyLocationUpdateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyLocationUpdateSchema) {
}
exports.AgencyLocationUpdateDto = AgencyLocationUpdateDto;
class AgencyRegistryCheckQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.agencyRegistryCheckQuerySchema) {
}
exports.AgencyRegistryCheckQueryDto = AgencyRegistryCheckQueryDto;
//# sourceMappingURL=dto.js.map