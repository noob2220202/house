import { InquiryChannel, type AgencyInquiryView } from '@house/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { DASHBOARD_INQUIRY_ITEMS } from '../constants';
import { InquiryMapper } from '../inquiry.mapper';
import { agencyInquirySelect } from '../inquiry.selects';
import { inboxWhere } from './agency-inquiries.service';

/** The inquiry block of the console home (`GET /agencies/mine/dashboard`). */
export interface InquiryDashboard {
  /** Unread rows of the inbox (written inquiries and contact events), as the nav badge. */
  unreadCount: number;
  /** Latest written inquiries (MESSAGE), newest activity first. */
  items: AgencyInquiryView[];
}

/**
 * Exported for the deal-requests module's ConsoleDashboardService, which composes the console
 * home. The caller has already resolved the acting office (ACTIVE member of an APPROVED office).
 */
@Injectable()
export class InquiryDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mapper: InquiryMapper,
  ) {}

  async forAgency(
    agencyId: string,
    limit: number = DASHBOARD_INQUIRY_ITEMS,
  ): Promise<InquiryDashboard> {
    const where = inboxWhere(agencyId);
    const [unreadCount, rows] = await Promise.all([
      this.prisma.inquiry.count({ where: { ...where, readAt: null } }),
      this.prisma.inquiry.findMany({
        where: { ...where, channel: InquiryChannel.MESSAGE },
        select: agencyInquirySelect(agencyId),
        orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
    ]);
    return { unreadCount, items: rows.map((r) => this.mapper.agency(r)) };
  }
}
