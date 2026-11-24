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
exports.InterestRegionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
/** 관심 지역 of a user (one row per user; no row = nothing selected). */
let InterestRegionsService = class InterestRegionsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async get(userId) {
        const row = await this.prisma.userInterestRegion.findUnique({
            where: { userId },
            select: { regionKeys: true, notify: true },
        });
        return { regionKeys: row?.regionKeys ?? [], notify: row?.notify ?? false };
    }
    /** Replaces the selection (already deduplicated, canonical and capped by the DTO). */
    async put(userId, dto) {
        const row = await this.prisma.userInterestRegion.upsert({
            where: { userId },
            create: { userId, regionKeys: dto.regionKeys, notify: dto.notify },
            update: { regionKeys: dto.regionKeys, notify: dto.notify },
            select: { regionKeys: true, notify: true },
        });
        return { regionKeys: row.regionKeys, notify: row.notify };
    }
};
exports.InterestRegionsService = InterestRegionsService;
exports.InterestRegionsService = InterestRegionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], InterestRegionsService);
//# sourceMappingURL=interest-regions.service.js.map