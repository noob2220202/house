import {
  adminLoginSchema,
  adminPasswordChangeSchema,
  adminTotpActivateSchema,
  adminTotpSetupSchema,
  adminTotpVerifySchema,
  consentInputSchema,
  oauthCallbackQuerySchema,
  oauthProviderParamSchema,
  oauthStartQuerySchema,
  sessionIdParamSchema,
  signupSchema,
  termsTypeParamSchema,
  termsVersionSchema,
  termsVersionQuerySchema,
  updateProfileSchema,
  withdrawSchema,
} from '@house/shared';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';

export class OAuthProviderParamDto extends createZodDto(oauthProviderParamSchema) {}
export class OAuthStartQueryDto extends createZodDto(oauthStartQuerySchema) {}
export class OAuthCallbackQueryDto extends createZodDto(oauthCallbackQuerySchema) {}
export class SignupDto extends createZodDto(signupSchema) {}
export class SessionIdParamDto extends createZodDto(sessionIdParamSchema) {}
export class UpdateProfileDto extends createZodDto(updateProfileSchema) {}
export class ConsentInputDto extends createZodDto(consentInputSchema) {}
export class WithdrawDto extends createZodDto(withdrawSchema) {}
export class TermsTypeParamDto extends createZodDto(termsTypeParamSchema) {}
export class TermsVersionQueryDto extends createZodDto(termsVersionQuerySchema) {}
/** GET /terms/:type/versions/:version */
export class TermsVersionParamDto extends createZodDto(
  termsTypeParamSchema.extend({ version: termsVersionSchema }),
) {}
export class AdminLoginDto extends createZodDto(adminLoginSchema) {}
export class AdminTotpVerifyDto extends createZodDto(adminTotpVerifySchema) {}
export class AdminTotpSetupDto extends createZodDto(adminTotpSetupSchema) {}
export class AdminTotpActivateDto extends createZodDto(adminTotpActivateSchema) {}
export class AdminPasswordChangeDto extends createZodDto(adminPasswordChangeSchema) {}
