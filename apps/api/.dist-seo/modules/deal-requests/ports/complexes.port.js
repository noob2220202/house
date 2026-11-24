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
exports.PrismaDealRequestComplexes = exports.DEAL_REQUEST_COMPLEXES = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
exports.DEAL_REQUEST_COMPLEXES = Symbol('DEAL_REQUEST_COMPLEXES');
let PrismaDealRequestComplexes = class PrismaDealRequestComplexes {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findActive(ids) {
        if (ids.length === 0)
            return Promise.resolve([]);
        return this.prisma.complex.findMany({
            where: { id: { in: [...new Set(ids)] }, deletedAt: null },
            select: {
                id: true,
                name: true,
                assetType: true,
                sggCode: true,
                emdCode: true,
                lat: true,
                lng: true,
            },
        });
    }
};
exports.PrismaDealRequestComplexes = PrismaDealRequestComplexes;
exports.PrismaDealRequestComplexes = PrismaDealRequestComplexes = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PrismaDealRequestComplexes);
//# sourceMappingURL=complexes.port.js.map