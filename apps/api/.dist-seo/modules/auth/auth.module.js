"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const session_resolver_1 = require("../../common/auth/session-resolver");
const deal_requests_module_1 = require("../deal-requests/deal-requests.module");
const home_module_1 = require("../home/home.module");
const listings_module_1 = require("../listings/listings.module");
const media_module_1 = require("../media/media.module");
const admin_auth_controller_1 = require("./admin/admin-auth.controller");
const admin_auth_service_1 = require("./admin/admin-auth.service");
const admin_ip_guard_1 = require("./admin/admin-ip.guard");
const password_service_1 = require("./admin/password.service");
const secret_box_1 = require("./admin/secret-box");
const totp_service_1 = require("./admin/totp.service");
const auth_constants_1 = require("./auth.constants");
const auth_controller_1 = require("./auth.controller");
const auth_maintenance_processor_1 = require("./jobs/auth-maintenance.processor");
const pii_scrub_service_1 = require("./jobs/pii-scrub.service");
const google_id_token_verifier_1 = require("./oauth/google-id-token.verifier");
const oauth_http_1 = require("./oauth/oauth-http");
const oauth_provider_1 = require("./oauth/oauth-provider");
const oauth_registry_1 = require("./oauth/oauth-registry");
const oauth_state_store_1 = require("./oauth/oauth-state.store");
const oauth_controller_1 = require("./oauth/oauth.controller");
const oauth_service_1 = require("./oauth/oauth.service");
const google_provider_1 = require("./oauth/providers/google.provider");
const kakao_provider_1 = require("./oauth/providers/kakao.provider");
const naver_provider_1 = require("./oauth/providers/naver.provider");
const session_service_1 = require("./session/session.service");
const pending_signup_store_1 = require("./signup/pending-signup.store");
const signup_service_1 = require("./signup/signup.service");
const terms_consent_guard_1 = require("./terms/terms-consent.guard");
const terms_controller_1 = require("./terms/terms.controller");
const terms_service_1 = require("./terms/terms.service");
const account_service_1 = require("./users/account.service");
const me_controller_1 = require("./users/me.controller");
const suspended_withdraw_store_1 = require("./users/suspended-withdraw.store");
const user_session_service_1 = require("./users/user-session.service");
const withdrawn_identity_service_1 = require("./users/withdrawn-identity.service");
/**
 * Auth module. Global so every module's guards resolve sessions through SESSION_RESOLVER and can
 * inject SessionService (logout-all on suspension, session refresh after agency approval) and
 * PasswordService (admin account management). Social login: 카카오 / 네이버 / Google only.
 * No SMS / phone verification exists (owner decision).
 */
let AuthModule = class AuthModule {
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Global)(),
    (0, common_1.Module)({
        imports: [
            bullmq_1.BullModule.registerQueue({ name: auth_constants_1.AUTH_QUEUE }),
            deal_requests_module_1.DealRequestsModule,
            home_module_1.HomeModule,
            listings_module_1.ListingsModule,
            media_module_1.MediaModule,
        ],
        controllers: [
            oauth_controller_1.OAuthController,
            auth_controller_1.AuthController,
            me_controller_1.MeController,
            terms_controller_1.TermsController,
            admin_auth_controller_1.AdminAuthController,
        ],
        providers: [
            session_service_1.SessionService,
            { provide: session_resolver_1.SESSION_RESOLVER, useExisting: session_service_1.SessionService },
            { provide: core_1.APP_GUARD, useClass: admin_ip_guard_1.AdminIpGuard },
            // After CoreModule's AuthGuard (needs req.principal): new required terms block writes.
            { provide: core_1.APP_GUARD, useClass: terms_consent_guard_1.TermsConsentGuard },
            // OAuth: the HTTP boundary is the only thing tests replace.
            { provide: oauth_http_1.OAUTH_HTTP, useClass: oauth_http_1.FetchOAuthHttpClient },
            google_id_token_verifier_1.GoogleIdTokenVerifier,
            kakao_provider_1.KakaoOAuthProvider,
            naver_provider_1.NaverOAuthProvider,
            google_provider_1.GoogleOAuthProvider,
            {
                provide: oauth_provider_1.OAUTH_PROVIDERS,
                inject: [kakao_provider_1.KakaoOAuthProvider, naver_provider_1.NaverOAuthProvider, google_provider_1.GoogleOAuthProvider],
                useFactory: (...providers) => providers,
            },
            oauth_registry_1.OAuthProviderRegistry,
            oauth_state_store_1.OAuthStateStore,
            oauth_service_1.OAuthService,
            pending_signup_store_1.PendingSignupStore,
            suspended_withdraw_store_1.SuspendedWithdrawStore,
            signup_service_1.SignupService,
            user_session_service_1.UserSessionService,
            account_service_1.AccountService,
            withdrawn_identity_service_1.WithdrawnIdentityService,
            terms_service_1.TermsService,
            password_service_1.PasswordService,
            secret_box_1.SecretBox,
            totp_service_1.TotpService,
            admin_auth_service_1.AdminAuthService,
            pii_scrub_service_1.PiiScrubService,
            auth_maintenance_processor_1.AuthMaintenanceProcessor,
        ],
        exports: [
            session_service_1.SessionService,
            session_resolver_1.SESSION_RESOLVER,
            user_session_service_1.UserSessionService,
            terms_service_1.TermsService,
            password_service_1.PasswordService,
            pii_scrub_service_1.PiiScrubService,
        ],
    })
], AuthModule);
//# sourceMappingURL=auth.module.js.map