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
exports.PrismaDealRequestListings = exports.DEAL_REQUEST_LISTINGS = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
exports.DEAL_REQUEST_LISTINGS = Symbol('DEAL_REQUEST_LISTINGS');
let PrismaDealRequestListings = class PrismaDealRequestListings {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async proposableIds(agencyId, ids, db = this.prisma) {
        if (ids.length === 0)
            return new Set();
        const rows = await db.listing.findMany({
            where: {
                id: { in: [...ids] },
                status: shared_1.ListingStatus.ACTIVE,
                deletedAt: null,
                agencies: { some: { agencyId, status: shared_1.ListingAgencyStatus.ACTIVE } },
            },
            select: { id: true },
        });
        return new Set(rows.map((r) => r.id));
    }
};
exports.PrismaDealRequestListings = PrismaDealRequestListings;
exports.PrismaDealRequestListings = PrismaDealRequestListings = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PrismaDealRequestListings);
//# sourceMappingURL=listings.port.js.map