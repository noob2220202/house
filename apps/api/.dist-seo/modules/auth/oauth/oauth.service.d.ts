import { type AuthProvider, type OAuthCallbackQuery, type OAuthStartQuery } from '@house/shared';
import type { Request, Response } from 'express';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { PendingSignupStore } from '../signup/pending-signup.store';
import { SuspendedWithdrawStore } from '../users/suspended-withdraw.store';
import { UserSessionService } from '../users/user-session.service';
import { WithdrawnIdentityService } from '../users/withdrawn-identity.service';
import { OAuthProviderRegistry } from './oauth-registry';
import { OAuthStateStore } from './oauth-state.store';
/**
 * Authorization-code flows for every registered provider.
 *  start: state + nonce + PKCE verifier in Redis (single use), state bound to the browser by a cookie
 *  callback: state check → code exchange → profile → login | pending signup | identity link
 *            (a suspended member gets no session, only a withdrawal ticket: SuspendedWithdrawStore)
 * Accounts are linked only through (provider, providerUserId) — never by email.
 * The callback never renders errors itself: it redirects to the web app with ?error=<code>.
 */
export declare class OAuthService {
    private readonly registry;
    private readonly states;
    private readonly pending;
    private readonly userSessions;
    private readonly sessions;
    private readonly prisma;
    private readonly config;
    private readonly withdrawn;
    private readonly suspendedWithdraw;
    private readonly logger;
    constructor(registry: OAuthProviderRegistry, states: OAuthStateStore, pending: PendingSignupStore, userSessions: UserSessionService, sessions: SessionService, prisma: PrismaService, config: AppConfig, withdrawn: WithdrawnIdentityService, suspendedWithdraw: SuspendedWithdrawStore);
    /** Returns the provider authorization URL to redirect the browser to. */
    start(provider: AuthProvider, query: OAuthStartQuery, req: Request, res: Response): Promise<string>;
    callback(provider: AuthProvider, query: OAuthCallbackQuery, req: Request, res: Response): Promise<string>;
    private loginOrSignup;
    private link;
    /** Reuses the browser's binding value so parallel flows (two tabs) both succeed. */
    private ensureBindingCookie;
    private bindingMatches;
    private loginError;
    /** Absolute URL on PUBLIC_BASE_URL; refuses to leave that origin whatever `path` contains. */
    private webUrl;
}
