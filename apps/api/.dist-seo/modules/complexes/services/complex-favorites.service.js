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
exports.ComplexFavoritesService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const complex_mapper_1 = require("../complex.mapper");
/** 관심 단지. Rows are always scoped by the caller's userId (no IDOR). */
let ComplexFavoritesService = class ComplexFavoritesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    /** Idempotent: favoriting twice keeps one row and counts once. */
    async add(userId, complexId) {
        const exists = await this.prisma.complex.count({ where: { id: complexId, deletedAt: null } });
        if (exists === 0)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.COMPLEX_NOT_FOUND);
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.favoriteComplex.createMany({
                data: [{ userId, complexId }],
                skipDuplicates: true,
            });
            if (count > 0) {
                await tx.complex.update({
                    where: { id: complexId },
                    data: { favoriteCount: { increment: 1 } },
                });
            }
        });
        return { complexId, favorited: true };
    }
    async remove(userId, complexId) {
        await this.prisma.$transaction(async (tx) => {
            const { count } = await tx.favoriteComplex.deleteMany({ where: { userId, complexId } });
            if (count > 0) {
                await tx.$executeRaw `
          UPDATE complexes SET favorite_count = GREATEST(favorite_count - 1, 0)
          WHERE id = ${complexId}::uuid`;
            }
        });
    }
    list(userId, q) {
        const where = { userId, complex: { deletedAt: null } };
        return (0, pagination_1.paginate)(q, async (args) => (await this.prisma.favoriteComplex.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { complexId: 'asc' }],
            select: { createdAt: true, complex: { select: complex_mapper_1.COMPLEX_SUMMARY_SELECT } },
            ...args,
        })).map((r) => ({
            favoritedAt: r.createdAt.toISOString(),
            complex: (0, complex_mapper_1.toComplexSummary)(r.complex),
        })), () => this.prisma.favoriteComplex.count({ where }));
    }
    async isFavorite(userId, complexId) {
        const row = await this.prisma.favoriteComplex.findUnique({
            where: { userId_complexId: { userId, complexId } },
            select: { userId: true },
        });
        return row !== null;
    }
};
exports.ComplexFavoritesService = ComplexFavoritesService;
exports.ComplexFavoritesService = ComplexFavoritesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ComplexFavoritesService);
//# sourceMappingURL=complex-favorites.service.js.map