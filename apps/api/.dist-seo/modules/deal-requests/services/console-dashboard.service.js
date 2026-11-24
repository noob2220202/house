"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleDashboardService = void 0;
const common_1 = require("@nestjs/common");
const agency_dashboard_service_1 = require("../../agencies/services/agency-dashboard.service");
const agency_actor_service_1 = require("./agency-actor.service");
const agency_inbox_service_1 = require("./agency-inbox.service");
/** Latest requests on the console home (the web shows four). */
const DASHBOARD_REQUEST_ITEMS = 4;
/**
 * Console home aggregate: listing / view numbers from the agencies module plus the request feed
 * of the inbox. Lives here because it composes the inbox (deal-requests depends on agencies).
 */
let ConsoleDashboardService = class ConsoleDashboardService {
    constructor(actors, inbox, listings) {
        this.actors = actors;
        this.inbox = inbox;
        this.listings = listings;
    }
    async get(user, now = new Date()) {
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
};
exports.ConsoleDashboardService = ConsoleDashboardService;
exports.ConsoleDashboardService = ConsoleDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [agency_actor_service_1.AgencyActorService,
        agency_inbox_service_1.AgencyInboxService,
        agency_dashboard_service_1.AgencyDashboardService])
], ConsoleDashboardService);
//# sourceMappingURL=console-dashboard.service.js.map