"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminPasswordChangeDto = exports.AdminTotpActivateDto = exports.AdminTotpSetupDto = exports.AdminTotpVerifyDto = exports.AdminLoginDto = exports.TermsVersionParamDto = exports.TermsVersionQueryDto = exports.TermsTypeParamDto = exports.WithdrawDto = exports.ConsentInputDto = exports.UpdateProfileDto = exports.SessionIdParamDto = exports.SignupDto = exports.OAuthCallbackQueryDto = exports.OAuthStartQueryDto = exports.OAuthProviderParamDto = void 0;
const shared_1 = require("@house/shared");
const zod_validation_pipe_1 = require("../../common/pipes/zod-validation.pipe");
class OAuthProviderParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.oauthProviderParamSchema) {
}
exports.OAuthProviderParamDto = OAuthProviderParamDto;
class OAuthStartQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.oauthStartQuerySchema) {
}
exports.OAuthStartQueryDto = OAuthStartQueryDto;
class OAuthCallbackQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.oauthCallbackQuerySchema) {
}
exports.OAuthCallbackQueryDto = OAuthCallbackQueryDto;
class SignupDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.signupSchema) {
}
exports.SignupDto = SignupDto;
class SessionIdParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.sessionIdParamSchema) {
}
exports.SessionIdParamDto = SessionIdParamDto;
class UpdateProfileDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.updateProfileSchema) {
}
exports.UpdateProfileDto = UpdateProfileDto;
class ConsentInputDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.consentInputSchema) {
}
exports.ConsentInputDto = ConsentInputDto;
class WithdrawDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.withdrawSchema) {
}
exports.WithdrawDto = WithdrawDto;
class TermsTypeParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.termsTypeParamSchema) {
}
exports.TermsTypeParamDto = TermsTypeParamDto;
class TermsVersionQueryDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.termsVersionQuerySchema) {
}
exports.TermsVersionQueryDto = TermsVersionQueryDto;
/** GET /terms/:type/versions/:version */
class TermsVersionParamDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.termsTypeParamSchema.extend({ version: shared_1.termsVersionSchema })) {
}
exports.TermsVersionParamDto = TermsVersionParamDto;
class AdminLoginDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminLoginSchema) {
}
exports.AdminLoginDto = AdminLoginDto;
class AdminTotpVerifyDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminTotpVerifySchema) {
}
exports.AdminTotpVerifyDto = AdminTotpVerifyDto;
class AdminTotpSetupDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminTotpSetupSchema) {
}
exports.AdminTotpSetupDto = AdminTotpSetupDto;
class AdminTotpActivateDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminTotpActivateSchema) {
}
exports.AdminTotpActivateDto = AdminTotpActivateDto;
class AdminPasswordChangeDto extends (0, zod_validation_pipe_1.createZodDto)(shared_1.adminPasswordChangeSchema) {
}
exports.AdminPasswordChangeDto = AdminPasswordChangeDto;
//# sourceMappingURL=dto.js.map