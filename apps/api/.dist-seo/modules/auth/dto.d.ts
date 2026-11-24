declare const OAuthProviderParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    provider: import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<"KAKAO" | "NAVER" | "GOOGLE", string>>;
}, import("zod/v4/core").$strip>>;
export declare class OAuthProviderParamDto extends OAuthProviderParamDto_base {
}
declare const OAuthStartQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    returnTo: import("zod").ZodOptional<import("zod").ZodString>;
    intent: import("zod").ZodDefault<import("zod").ZodEnum<{
        login: "login";
        link: "link";
    }>>;
}, import("zod/v4/core").$strip>>;
export declare class OAuthStartQueryDto extends OAuthStartQueryDto_base {
}
declare const OAuthCallbackQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    code: import("zod").ZodOptional<import("zod").ZodString>;
    state: import("zod").ZodString;
    error: import("zod").ZodOptional<import("zod").ZodString>;
    error_description: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class OAuthCallbackQueryDto extends OAuthCallbackQueryDto_base {
}
declare const SignupDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    nickname: import("zod").ZodString;
    ageOver14: import("zod").ZodLiteral<true>;
    phone: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>>;
    consents: import("zod").ZodArray<import("zod").ZodObject<{
        termsDocumentId: import("zod").ZodUUID;
        agreed: import("zod").ZodBoolean;
    }, import("zod/v4/core").$strip>>;
    marketingOptIn: import("zod").ZodDefault<import("zod").ZodBoolean>;
}, import("zod/v4/core").$strip>>;
export declare class SignupDto extends SignupDto_base {
}
declare const SessionIdParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    id: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class SessionIdParamDto extends SessionIdParamDto_base {
}
declare const UpdateProfileDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    nickname: import("zod").ZodOptional<import("zod").ZodString>;
    phone: import("zod").ZodOptional<import("zod").ZodNullable<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>>;
    marketingOptIn: import("zod").ZodOptional<import("zod").ZodBoolean>;
}, import("zod/v4/core").$strip>>;
export declare class UpdateProfileDto extends UpdateProfileDto_base {
}
declare const ConsentInputDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    consents: import("zod").ZodArray<import("zod").ZodObject<{
        termsDocumentId: import("zod").ZodUUID;
        agreed: import("zod").ZodBoolean;
    }, import("zod/v4/core").$strip>>;
}, import("zod/v4/core").$strip>>;
export declare class ConsentInputDto extends ConsentInputDto_base {
}
declare const WithdrawDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    confirm: import("zod").ZodLiteral<true>;
    reason: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class WithdrawDto extends WithdrawDto_base {
}
declare const TermsTypeParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    type: import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodEnum<{
        readonly SERVICE: "SERVICE";
        readonly PRIVACY: "PRIVACY";
        readonly LOCATION: "LOCATION";
        readonly MARKETING: "MARKETING";
        readonly PRIVACY_AGENCY_APPLICATION: "PRIVACY_AGENCY_APPLICATION";
        readonly PRIVACY_AGENCY_JOIN: "PRIVACY_AGENCY_JOIN";
        readonly DEAL_REQUEST_PRIVACY: "DEAL_REQUEST_PRIVACY";
        readonly DEAL_REQUEST_PROVIDE: "DEAL_REQUEST_PROVIDE";
    }>>;
}, import("zod/v4/core").$strip>>;
export declare class TermsTypeParamDto extends TermsTypeParamDto_base {
}
declare const TermsVersionQueryDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    version: import("zod").ZodOptional<import("zod").ZodString>;
}, import("zod/v4/core").$strip>>;
export declare class TermsVersionQueryDto extends TermsVersionQueryDto_base {
}
declare const TermsVersionParamDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    type: import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodEnum<{
        readonly SERVICE: "SERVICE";
        readonly PRIVACY: "PRIVACY";
        readonly LOCATION: "LOCATION";
        readonly MARKETING: "MARKETING";
        readonly PRIVACY_AGENCY_APPLICATION: "PRIVACY_AGENCY_APPLICATION";
        readonly PRIVACY_AGENCY_JOIN: "PRIVACY_AGENCY_JOIN";
        readonly DEAL_REQUEST_PRIVACY: "DEAL_REQUEST_PRIVACY";
        readonly DEAL_REQUEST_PROVIDE: "DEAL_REQUEST_PROVIDE";
    }>>;
    version: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
/** GET /terms/:type/versions/:version */
export declare class TermsVersionParamDto extends TermsVersionParamDto_base {
}
declare const AdminLoginDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    email: import("zod").ZodPipe<import("zod").ZodEmail, import("zod").ZodTransform<string, string>>;
    password: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class AdminLoginDto extends AdminLoginDto_base {
}
declare const AdminTotpVerifyDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    code: import("zod").ZodOptional<import("zod").ZodString>;
    recoveryCode: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>;
}, import("zod/v4/core").$strip>>;
export declare class AdminTotpVerifyDto extends AdminTotpVerifyDto_base {
}
declare const AdminTotpSetupDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodDefault<import("zod").ZodObject<{
    currentPassword: import("zod").ZodOptional<import("zod").ZodString>;
    code: import("zod").ZodOptional<import("zod").ZodString>;
    recoveryCode: import("zod").ZodOptional<import("zod").ZodPipe<import("zod").ZodPipe<import("zod").ZodString, import("zod").ZodTransform<string, string>>, import("zod").ZodString>>;
}, import("zod/v4/core").$strip>>>;
export declare class AdminTotpSetupDto extends AdminTotpSetupDto_base {
}
declare const AdminTotpActivateDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    code: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class AdminTotpActivateDto extends AdminTotpActivateDto_base {
}
declare const AdminPasswordChangeDto_base: import("../../common/pipes/zod-validation.pipe").ZodDto<import("zod").ZodObject<{
    currentPassword: import("zod").ZodString;
    newPassword: import("zod").ZodString;
}, import("zod/v4/core").$strip>>;
export declare class AdminPasswordChangeDto extends AdminPasswordChangeDto_base {
}
export {};
