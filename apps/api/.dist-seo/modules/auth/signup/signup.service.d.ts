import { type PendingSignupResponse, type SignupInput, type SignupResponse } from '@house/shared';
import type { Request, Response } from 'express';
import { PrismaService } from '../../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import { TermsService } from '../terms/terms.service';
import { AccountService } from '../users/account.service';
import { UserSessionService } from '../users/user-session.service';
import { WithdrawnIdentityService } from '../users/withdrawn-identity.service';
import { PendingSignupStore } from './pending-signup.store';
/**
 * Second half of a first social login: 만 14세 이상 confirmation (schema-enforced, stored as
 * ageConfirmedAt) + terms consent → User + Identity + consents → session.
 */
export declare class SignupService {
    private readonly pending;
    private readonly terms;
    private readonly prisma;
    private readonly sessions;
    private readonly userSessions;
    private readonly accounts;
    private readonly withdrawn;
    constructor(pending: PendingSignupStore, terms: TermsService, prisma: PrismaService, sessions: SessionService, userSessions: UserSessionService, accounts: AccountService, withdrawn: WithdrawnIdentityService);
    /** Prefill for the signup form (the provider profile of this browser's pending signup). */
    describe(req: Request): Promise<PendingSignupResponse>;
    complete(req: Request, res: Response, dto: SignupInput): Promise<SignupResponse>;
    private load;
}
