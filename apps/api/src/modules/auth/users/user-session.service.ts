import { Injectable } from '@nestjs/common';
import { AgencyMemberStatus, AgencyStatus, type UserRole } from '@house/shared';
import type { Request, Response } from 'express';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { readSessionCookie, SessionService } from '../session/session.service';
import type { SessionRecord } from '../session/session.types';

export interface ActiveMembership {
  agencyId: string;
  agencyName: string;
  agencyStatus: AgencyStatus;
  memberRole: string;
}

const ACTING_AGENCY_STATUSES: AgencyStatus[] = [
  AgencyStatus.APPROVED,
  AgencyStatus.PENDING,
  AgencyStatus.SUSPENDED,
];

/** Starts site-user sessions and computes the agency a user acts for. */
@Injectable()
export class UserSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * The agency membership a session acts for: an ACTIVE membership of a live (not rejected/deleted)
   * agency, preferring an APPROVED one. Exported so the agencies module can refresh sessions after
   * approval (`SessionService.updateAllForSubject`).
   */
  async activeMembership(
    userId: string,
    db: PrismaTx = this.prisma,
  ): Promise<ActiveMembership | null> {
    const rows = await db.agencyMember.findMany({
      where: {
        userId,
        status: AgencyMemberStatus.ACTIVE,
        agency: { deletedAt: null, status: { in: ACTING_AGENCY_STATUSES } },
      },
      orderBy: { joinedAt: 'asc' },
      take: 10,
      select: { role: true, agency: { select: { id: true, name: true, status: true } } },
    });
    const pick = rows.find((r) => r.agency.status === AgencyStatus.APPROVED) ?? rows[0];
    return pick
      ? {
          agencyId: pick.agency.id,
          agencyName: pick.agency.name,
          agencyStatus: pick.agency.status,
          memberRole: pick.role,
        }
      : null;
  }

  /** Issues a fresh session (dropping any session the browser already had: no fixation). */
  async start(
    req: Request,
    res: Response,
    user: { id: string; role: UserRole },
  ): Promise<SessionRecord> {
    const previous = readSessionCookie(req, 'USER');
    if (previous) await this.sessions.destroy(previous);
    const membership = await this.activeMembership(user.id);
    const ua = req.headers['user-agent'];
    const { token, record } = await this.sessions.create({
      kind: 'USER',
      userId: user.id,
      role: user.role,
      agencyId: membership?.agencyId ?? null,
      ip: req.ip,
      userAgent: typeof ua === 'string' ? ua : undefined,
    });
    this.sessions.setCookies(res, 'USER', token, record);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return record;
  }
}
