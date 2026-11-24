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
exports.HomeUserDataService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
/**
 * Personal data the home module keeps per user (관심 중개사무소, 관심 지역). Exported for the
 * withdrawal PII scrub (auth PiiScrubService), which should call `purge` inside its transaction:
 * these tables have no FK to users, so nothing cascades.
 */
let HomeUserDataService = class HomeUserDataService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async purge(userIds, db = this.prisma) {
        if (userIds.length === 0)
            return;
        const ids = [...userIds];
        await db.favoriteAgency.deleteMany({ where: { userId: { in: ids } } });
        await db.userInterestRegion.deleteMany({ where: { userId: { in: ids } } });
    }
};
exports.HomeUserDataService = HomeUserDataService;
exports.HomeUserDataService = HomeUserDataService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], HomeUserDataService);
//# sourceMappingURL=home-user-data.service.js.map