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
exports.PrismaAdsReferences = exports.ADS_REFERENCES = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const prisma_service_1 = require("../../../prisma/prisma.service");
exports.ADS_REFERENCES = Symbol('ADS_REFERENCES');
let PrismaAdsReferences = class PrismaAdsReferences {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async assertAgency(agencyId, db = this.prisma) {
        const n = await db.agency.count({
            where: { id: agencyId, deletedAt: null, status: shared_1.AgencyStatus.APPROVED },
        });
        if (n !== 1)
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.BANNER_AGENCY_INVALID);
    }
    async assertRegions(codes, db = this.prisma) {
        if (codes.length === 0)
            return;
        const rows = await db.region.findMany({
            where: { code: { in: [...codes] }, isActive: true },
            select: { code: true },
        });
        const found = new Set(rows.map((r) => r.code));
        const missing = codes.filter((c) => !found.has(c));
        if (missing.length > 0) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.BANNER_TARGET_INVALID, {
                missingRegionCodes: missing,
            });
        }
    }
    async assertComplexes(ids, db = this.prisma) {
        if (ids.length === 0)
            return;
        const rows = await db.complex.findMany({
            where: { id: { in: [...ids] }, deletedAt: null },
            select: { id: true },
        });
        const found = new Set(rows.map((r) => r.id));
        const missing = ids.filter((id) => !found.has(id));
        if (missing.length > 0) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.BANNER_TARGET_INVALID, {
                missingComplexIds: missing,
            });
        }
    }
    async complexRegionCodes(complexId) {
        const c = await this.prisma.complex.findFirst({
            where: { id: complexId, deletedAt: null },
            select: { sggCode: true, emdCode: true },
        });
        if (!c)
            return [];
        return [c.sggCode, c.emdCode].filter((x) => typeof x === 'string');
    }
    async complexRegionCodesMany(ids, db = this.prisma) {
        const unique = [...new Set(ids)];
        if (unique.length === 0)
            return new Map();
        const rows = await db.complex.findMany({
            where: { id: { in: unique }, deletedAt: null },
            select: { id: true, sggCode: true, emdCode: true },
        });
        return new Map(rows.map((c) => [
            c.id,
            [c.sggCode, c.emdCode].filter((x) => typeof x === 'string'),
        ]));
    }
};
exports.PrismaAdsReferences = PrismaAdsReferences;
exports.PrismaAdsReferences = PrismaAdsReferences = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PrismaAdsReferences);
//# sourceMappingURL=ads-references.port.js.map