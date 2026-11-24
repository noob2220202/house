import type { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { TermsService } from '../auth/terms/terms.service';
import { UserSessionService } from '../auth/users/user-session.service';
import type { E2eLoginInput, E2eLoginResponse } from './e2e-auth.dto';
/**
 * Test-only stand-in for the social login callback: finds (or creates) a member and starts the
 * session through the same UserSessionService.start the real OAuth callback / signup use, so
 * cookies, CSRF token, acting agency and lastLoginAt behave exactly like production.
 */
export declare class E2eAuthService {
    private readonly prisma;
    private readonly terms;
    private readonly userSessions;
    private readonly logger;
    constructor(prisma: PrismaService, terms: TermsService, userSessions: UserSessionService);
    login(dto: E2eLoginInput, req: Request, res: Response): Promise<E2eLoginResponse>;
    /** A member as signup creates one: USER role, 만 14세 확인, one (fake) Kakao identity. */
    private createMember;
    private agreeRequiredTerms;
}
