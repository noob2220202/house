import { type OnModuleInit } from '@nestjs/common';
/**
 * TEST-ONLY. AppModule imports this only when e2eFakeAuthEnabled() (NODE_ENV=test and
 * E2E_FAKE_OAUTH=1). Depends on AuthModule's global exports (UserSessionService, TermsService).
 */
export declare class E2eAuthModule implements OnModuleInit {
    onModuleInit(): void;
}
