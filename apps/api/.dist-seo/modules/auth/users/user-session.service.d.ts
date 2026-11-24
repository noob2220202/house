import { AgencyStatus, type UserRole } from '@house/shared';
import type { Request, Response } from 'express';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { SessionService } from '../session/session.service';
import type { SessionRecord } from '../session/session.types';
export interface ActiveMembership {
    agencyId: string;
    agencyName: string;
    agencyStatus: AgencyStatus;
    memberRole: string;
}
/** Starts site-user sessions and computes the agency a user acts for. */
export declare class UserSessionService {
    private readonly prisma;
    private readonly sessions;
    constructor(prisma: PrismaService, sessions: SessionService);
    /**
     * ACTIVE memberships of live (not rejected/deleted) agencies, APPROVED ones first. The first one
     * is the agency a new session acts for.
     */
    activeMemberships(userId: string, db?: PrismaTx): Promise<ActiveMembership[]>;
    activeMembership(userId: string, db?: PrismaTx): Promise<ActiveMembership | null>;
    /** Issues a fresh session (dropping any session the browser already had: no fixation). */
    start(req: Request, res: Response, user: {
        id: string;
        role: UserRole;
    }): Promise<SessionRecord>;
}
