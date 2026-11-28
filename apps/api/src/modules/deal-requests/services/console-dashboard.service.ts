import type { AgencyDealRequestView, AgencyInquiryView } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { UserPrincipal } from '../../../common/auth/principal';
import {
  AgencyDashboardService,
  type AgencyListingDashboard,
} from '../../agencies/services/agency-dashboard.service';
import { InquiryDashboardService } from '../../inquiries/services/inquiry-dashboard.service';
import { AgencyActorService } from './agency-actor.service';
import { AgencyInboxService } from './agency-inbox.service';

/** Latest requests on the console home (the web shows four). */
const DASHBOARD_REQUEST_ITEMS = 4;

/** `GET /agencies/mine/dashboard` (web `agencyDashboardSchema`). */
export interface AgencyConsoleDashboard extends AgencyListingDashboard {
  dealRequests: {
    newCount: number;
    newSellCount: number;
    newWantedCount: number;
    items: AgencyDealRequestView[];
  };
  /** Unread inbox rows (nav badge) + the latest written inquiries (InquiryDashboardService). */
  inquiries: { unreadCount: number; items: AgencyInquiryView[] };
}

/**
 * Console home aggregate: listing / view numbers from the agencies module, the request feed of
 * the inbox and the inquiry block of the inquiries module. Lives here because it composes the
 * inbox (deal-requests depends on agencies and inquiries).
 */
@Injectable()
export class ConsoleDashboardService {
  constructor(
    private readonly actors: AgencyActorService,
    private readonly inbox: AgencyInboxService,
    private readonly listings: AgencyDashboardService,
    private readonly inquiryDashboard: InquiryDashboardService,
  ) {}

  async get(user: UserPrincipal, now: Date = new Date()): Promise<AgencyConsoleDashboard> {
    const actor = await this.actors.resolve(user);
    const [listingPart, dealRequests, inquiries] = await Promise.all([
      this.listings.listingDashboard(actor.agencyId, now),
      this.inbox.dashboardFor(actor, DASHBOARD_REQUEST_ITEMS, now),
      this.inquiryDashboard.forAgency(actor.agencyId),
    ]);
    return {
      listings: listingPart.listings,
      views: listingPart.views,
      dealRequests,
      inquiries,
      expiringListings: listingPart.expiringListings,
      verificationDue: listingPart.verificationDue,
    };
  }
}
