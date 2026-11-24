import type { AdminLoginResponse, AdminMeResponse, AdminSessionResponse, AdminTotpActivateResponse, AdminTotpSetupResponse, CsrfTokenResponse } from '@house/shared';
import type { Request, Response } from 'express';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AdminLoginDto, AdminPasswordChangeDto, AdminTotpActivateDto, AdminTotpSetupDto, AdminTotpVerifyDto } from '../dto';
import { SessionService } from '../session/session.service';
import { AdminAuthService } from './admin-auth.service';
/**
 * Back-office authentication. `@Public()` here only means "the global guard doesn't demand a
 * TOTP-verified session": the TOTP endpoints still require the pre-MFA admin session from login
 * (@CurrentAdmin → 401 without one).
 */
export declare class AdminAuthController {
    private readonly auth;
    private readonly sessions;
    constructor(auth: AdminAuthService, sessions: SessionService);
    login(dto: AdminLoginDto, req: Request, res: Response): Promise<AdminLoginResponse>;
    csrf(req: Request, res: Response): CsrfTokenResponse;
    /**
     * Starts TOTP enrollment (first login) or rotation (verified session + current password + current
     * code or recovery code in the body).
     */
    setup(admin: AdminPrincipal, dto: AdminTotpSetupDto, req: Request): Promise<AdminTotpSetupResponse>;
    activate(admin: AdminPrincipal, dto: AdminTotpActivateDto, req: Request, res: Response): Promise<AdminTotpActivateResponse>;
    verify(admin: AdminPrincipal, dto: AdminTotpVerifyDto, req: Request, res: Response): Promise<AdminSessionResponse>;
    me(admin: AdminPrincipal): Promise<AdminMeResponse>;
    logout(_admin: AdminPrincipal, req: Request, res: Response): Promise<void>;
    changePassword(admin: AdminPrincipal, dto: AdminPasswordChangeDto, req: Request, res: Response): Promise<AdminSessionResponse>;
}
