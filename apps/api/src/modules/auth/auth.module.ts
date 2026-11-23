import { Global, Module } from '@nestjs/common';
import { SESSION_RESOLVER } from '../../common/auth/session-resolver';
import { SessionService } from './session/session.service';

/**
 * Auth module (owned by the auth team). Global so every module's guards can resolve sessions
 * through SESSION_RESOLVER. Controllers/services for OAuth (카카오/네이버/Google), admin login + TOTP,
 * terms/consents and withdrawal are added here — see README.md. No SMS / phone verification.
 */
@Global()
@Module({
  providers: [SessionService, { provide: SESSION_RESOLVER, useExisting: SessionService }],
  exports: [SessionService, SESSION_RESOLVER],
})
export class AuthModule {}
