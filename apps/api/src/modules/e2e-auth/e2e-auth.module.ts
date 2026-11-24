import { Module, type OnModuleInit } from '@nestjs/common';
import { E2eAuthController } from './e2e-auth.controller';
import { e2eFakeAuthEnabled } from './e2e-auth.enabled';
import { E2eOnlyGuard } from './e2e-auth.guard';
import { E2eAuthService } from './e2e-auth.service';

/**
 * TEST-ONLY. AppModule imports this only when e2eFakeAuthEnabled() (NODE_ENV=test and
 * E2E_FAKE_OAUTH=1). Depends on AuthModule's global exports (UserSessionService, TermsService).
 */
@Module({
  controllers: [E2eAuthController],
  providers: [E2eAuthService, E2eOnlyGuard],
})
export class E2eAuthModule implements OnModuleInit {
  onModuleInit(): void {
    if (!e2eFakeAuthEnabled()) {
      throw new Error('E2eAuthModule must only be loaded with NODE_ENV=test and E2E_FAKE_OAUTH=1');
    }
  }
}
