import type { AgencyDealRequestView } from '@house/shared';
import { Injectable } from '@nestjs/common';
import type { UserPrincipal } from '../../../common/auth/principal';
import {
  AgencyDashboardService,
  type AgencyListingDashboard,
} from '../../agencies/services/agency-dashboard.service';
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
  /**
   * Always empty: there is no inquiry backend for launch (DECISIONS D5); the console hides the
   * inquiry widgets. Kept because the web schema requires the object.
   */
  inquiries: { unreadCount: number; items: never[] };
}

/**
 * Console home aggregate: listing / view numbers from the agencies module plus the request feed
 * of the inbox. Lives here because it composes the inbox (deal-requests depends on agencies).
 */
@Injectable()
export class ConsoleDashboardService {
  constructor(
    private readonly actors: AgencyActorService,
    private readonly inbox: AgencyInboxService,
    private readonly listings: AgencyDashboardService,
  ) {}

  async get(user: UserPrincipal, now: Date = new Date()): Promise<AgencyConsoleDashboard> {
    const actor = await this.actors.resolve(user);
    const [listingPart, dealRequests] = await Promise.all([
      this.listings.listingDashboard(actor.agencyId, now),
      this.inbox.dashboardFor(actor, DASHBOARD_REQUEST_ITEMS, now),
    ]);
    return {
      listings: listingPart.listings,
      views: listingPart.views,
      dealRequests,
      inquiries: { unreadCount: 0, items: [] },
      expiringListings: listingPart.expiringListings,
      verificationDue: listingPart.verificationDue,
    };
  }
}
