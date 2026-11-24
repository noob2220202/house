import { type AuthProvider, type CsrfTokenResponse, type MeResponse, type PendingSignupResponse, type SessionSummary, type SignupResponse } from '@house/shared';
import type { Request, Response } from 'express';
import type { UserPrincipal } from '../../common/auth/principal';
import { SessionIdParamDto, SignupDto, WithdrawDto } from './dto';
import { OAuthProviderRegistry } from './oauth/oauth-registry';
import { SessionService } from './session/session.service';
import { SignupService } from './signup/signup.service';
import { AccountService } from './users/account.service';
export declare class AuthController {
    private readonly sessions;
    private readonly accounts;
    private readonly signup;
    private readonly registry;
    constructor(sessions: SessionService, accounts: AccountService, signup: SignupService, registry: OAuthProviderRegistry);
    /** Enabled social login providers, for the login page. */
    providers(): {
        provider: AuthProvider;
        slug: string;
        label: string;
    }[];
    /**
     * (Re-)issues the CSRF cookie and returns the token. With a session it is the session's token
     * (what CsrfGuard checks); without one a fresh random token is returned (nothing to protect yet).
     * Frontends should prefer the body value over reading the cookie.
     */
    csrf(req: Request, res: Response): CsrfTokenResponse;
    me(user: UserPrincipal): Promise<MeResponse>;
    logout(_user: UserPrincipal, req: Request, res: Response): Promise<void>;
    logoutAll(user: UserPrincipal, res: Response): Promise<{
        revoked: number;
    }>;
    /** Logged-in devices of the current user. */
    listSessions(user: UserPrincipal): Promise<SessionSummary[]>;
    revokeSession(user: UserPrincipal, params: SessionIdParamDto, res: Response): Promise<void>;
    /** Pending social signup (after the first OAuth callback): profile prefill + current terms. */
    pendingSignup(req: Request): Promise<PendingSignupResponse>;
    completeSignup(dto: SignupDto, req: Request, res: Response): Promise<SignupResponse>;
    /**
     * 회원 탈퇴 of a suspended member (no session): authenticated by the `house_withdraw` ticket the
     * refused social login set (redirect `/login?error=AUTH_ACCOUNT_SUSPENDED&withdrawable=1`).
     * Logged-in members use POST /me/withdraw.
     */
    withdrawSuspended(dto: WithdrawDto, req: Request, res: Response): Promise<void>;
}
