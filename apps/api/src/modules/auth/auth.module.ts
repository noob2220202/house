import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SESSION_RESOLVER } from '../../common/auth/session-resolver';
import { DealRequestsModule } from '../deal-requests/deal-requests.module';
import { ListingsModule } from '../listings/listings.module';
import { MediaModule } from '../media/media.module';
import { AdminAuthController } from './admin/admin-auth.controller';
import { AdminAuthService } from './admin/admin-auth.service';
import { AdminIpGuard } from './admin/admin-ip.guard';
import { PasswordService } from './admin/password.service';
import { SecretBox } from './admin/secret-box';
import { TotpService } from './admin/totp.service';
import { AUTH_QUEUE } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthMaintenanceProcessor } from './jobs/auth-maintenance.processor';
import { PiiScrubService } from './jobs/pii-scrub.service';
import { GoogleIdTokenVerifier } from './oauth/google-id-token.verifier';
import { FetchOAuthHttpClient, OAUTH_HTTP } from './oauth/oauth-http';
import { OAUTH_PROVIDERS, type OAuthProvider } from './oauth/oauth-provider';
import { OAuthProviderRegistry } from './oauth/oauth-registry';
import { OAuthStateStore } from './oauth/oauth-state.store';
import { OAuthController } from './oauth/oauth.controller';
import { OAuthService } from './oauth/oauth.service';
import { GoogleOAuthProvider } from './oauth/providers/google.provider';
import { KakaoOAuthProvider } from './oauth/providers/kakao.provider';
import { NaverOAuthProvider } from './oauth/providers/naver.provider';
import { SessionService } from './session/session.service';
import { PendingSignupStore } from './signup/pending-signup.store';
import { SignupService } from './signup/signup.service';
import { TermsConsentGuard } from './terms/terms-consent.guard';
import { TermsController } from './terms/terms.controller';
import { TermsService } from './terms/terms.service';
import { AccountService } from './users/account.service';
import { MeController } from './users/me.controller';
import { SuspendedWithdrawStore } from './users/suspended-withdraw.store';
import { UserSessionService } from './users/user-session.service';
import { WithdrawnIdentityService } from './users/withdrawn-identity.service';

/**
 * Auth module. Global so every module's guards resolve sessions through SESSION_RESOLVER and can
 * inject SessionService (logout-all on suspension, session refresh after agency approval) and
 * PasswordService (admin account management). Social login: 카카오 / 네이버 / Google only.
 * No SMS / phone verification exists (owner decision).
 */
@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: AUTH_QUEUE }),
    DealRequestsModule,
    ListingsModule,
    MediaModule,
  ],
  controllers: [
    OAuthController,
    AuthController,
    MeController,
    TermsController,
    AdminAuthController,
  ],
  providers: [
    SessionService,
    { provide: SESSION_RESOLVER, useExisting: SessionService },
    { provide: APP_GUARD, useClass: AdminIpGuard },
    // After CoreModule's AuthGuard (needs req.principal): new required terms block writes.
    { provide: APP_GUARD, useClass: TermsConsentGuard },
    // OAuth: the HTTP boundary is the only thing tests replace.
    { provide: OAUTH_HTTP, useClass: FetchOAuthHttpClient },
    GoogleIdTokenVerifier,
    KakaoOAuthProvider,
    NaverOAuthProvider,
    GoogleOAuthProvider,
    {
      provide: OAUTH_PROVIDERS,
      inject: [KakaoOAuthProvider, NaverOAuthProvider, GoogleOAuthProvider],
      useFactory: (...providers: OAuthProvider[]): OAuthProvider[] => providers,
    },
    OAuthProviderRegistry,
    OAuthStateStore,
    OAuthService,
    PendingSignupStore,
    SuspendedWithdrawStore,
    SignupService,
    UserSessionService,
    AccountService,
    WithdrawnIdentityService,
    TermsService,
    PasswordService,
    SecretBox,
    TotpService,
    AdminAuthService,
    PiiScrubService,
    AuthMaintenanceProcessor,
  ],
  exports: [
    SessionService,
    SESSION_RESOLVER,
    UserSessionService,
    TermsService,
    PasswordService,
    PiiScrubService,
  ],
})
export class AuthModule {}
