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
exports.RegionNamesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const region_name_1 = require("../domain/region-name");
/** 법정동 display names from the `regions` table (one query per call). */
let RegionNamesService = class RegionNamesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** code → name for every code that resolves (unknown codes are left out). */
    async namesOf(codes) {
        const wanted = [...new Set(codes.filter((c) => !!c && c.length >= 8))];
        if (wanted.length === 0)
            return new Map();
        const rows = await this.prisma.region.findMany({
            where: { code: { in: [...new Set(wanted.flatMap(region_name_1.regionNameCandidates))] } },
            select: { code: true, name: true, level: true, parent: { select: { name: true } } },
        });
        const byCode = new Map(rows.map((r) => [r.code, r]));
        const out = new Map();
        for (const code of wanted) {
            const name = (0, region_name_1.regionNameOf)(code, byCode);
            if (name)
                out.set(code, name);
        }
        return out;
    }
};
exports.RegionNamesService = RegionNamesService;
exports.RegionNamesService = RegionNamesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], RegionNamesService);
//# sourceMappingURL=region-names.service.js.map