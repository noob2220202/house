"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaListingNotifier = exports.LISTING_NOTIFIER = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
exports.LISTING_NOTIFIER = Symbol('LISTING_NOTIFIER');
let PrismaListingNotifier = class PrismaListingNotifier {
    async notifyAgencyOwners(db, agencyIds, notice) {
        const ids = [...new Set(agencyIds)];
        if (ids.length === 0)
            return;
        const owners = await db.agencyMember.findMany({
            where: {
                agencyId: { in: ids },
                role: shared_1.AgencyMemberRole.OWNER,
                status: shared_1.AgencyMemberStatus.ACTIVE,
            },
            select: { userId: true, agencyId: true },
            orderBy: { createdAt: 'asc' },
        });
        // One row per user (first agency wins), as createForMembers does.
        const agencyOf = new Map();
        for (const o of owners)
            if (!agencyOf.has(o.userId))
                agencyOf.set(o.userId, o.agencyId);
        if (agencyOf.size === 0)
            return;
        await db.notification.createMany({
            data: [...agencyOf].map(([userId, agencyId]) => ({
                userId,
                type: notice.type,
                title: notice.title,
                body: notice.body,
                data: { listingId: notice.listingId, agencyId },
            })),
        });
    }
};
exports.PrismaListingNotifier = PrismaListingNotifier;
exports.PrismaListingNotifier = PrismaListingNotifier = __decorate([
    (0, common_1.Injectable)()
], PrismaListingNotifier);
//# sourceMappingURL=listing-notifier.port.js.map