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
exports.AdminSearchService = void 0;
exports.searchVariants = searchVariants;
exports.registrationKeyOf = registrationKeyOf;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const admin_format_1 = require("./admin-format");
const ci = (value) => ({ contains: value, mode: 'insensitive' });
/** The query as typed and without spaces / hyphens ("신대 레이크-파크" also finds "신대레이크파크"). */
function searchVariants(q) {
    const compact = q.replace(/[\s-]+/g, '');
    return [...new Set([q, compact].filter((v) => v.length > 0))];
}
/** Registration-number search key, the way `agencies.registration_key` is generated. */
function registrationKeyOf(q) {
    return q.replace(/[^0-9A-Za-z가-힣]/g, '').toUpperCase();
}
const listingSelect = {
    id: true,
    listingNo: true,
    title: true,
    dealType: true,
    status: true,
    salePrice: true,
    presalePrice: true,
    deposit: true,
    monthlyRent: true,
    exclusiveArea: true,
    emdCode: true,
    complex: { select: { name: true } },
    property: { select: { buildingName: true, roadAddress: true } },
    primaryAgency: { select: { name: true } },
};
const agencySelect = {
    id: true,
    name: true,
    representativeName: true,
    registrationNumber: true,
    status: true,
    emdCode: true,
    activeListingCount: true,
};
const userSelect = {
    id: true,
    nickname: true,
    name: true,
    email: true,
    phone: true,
    role: true,
    status: true,
    createdAt: true,
    identities: { select: { provider: true }, orderBy: { createdAt: 'asc' }, take: 1 },
};
/**
 * Topbar search of the back office: listings (매물번호, title, complex, building, address, office, 읍면동),
 * agencies (name, 대표, 등록번호, address, 읍면동) and members (nickname, name, e-mail, phone).
 * Members are matched on full values but returned masked. Read-only, never cached (free text).
 */
let AdminSearchService = class AdminSearchService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async search(q) {
        const query = q.q.trim();
        const variants = searchVariants(query);
        const emdCodes = await this.matchingRegionCodes(variants);
        const [listings, agencies, users] = await Promise.all([
            this.listings(variants, emdCodes, (0, shared_1.parseListingNo)(query), q.limit),
            this.agencies(query, variants, emdCodes, q.limit),
            this.users(query, variants, q.limit),
        ]);
        return { query, listings, agencies, users };
    }
    /** 읍면동 / 리 of the service area whose name matches ("조례" → 조례동). */
    async matchingRegionCodes(variants) {
        const rows = await this.prisma.region.findMany({
            where: {
                code: { startsWith: shared_1.DEFAULT_SGG_CODE },
                level: { in: ['EMD', 'RI'] },
                OR: variants.map((v) => ({ name: ci(v) })),
            },
            select: { code: true },
            take: 50,
        });
        return rows.map((r) => r.code);
    }
    async listings(variants, emdCodes, listingNo, limit) {
        const or = variants.flatMap((v) => [
            { title: ci(v) },
            { complex: { name: ci(v) } },
            { property: { buildingName: ci(v) } },
            { property: { roadAddress: ci(v) } },
            { primaryAgency: { name: ci(v) } },
        ]);
        if (emdCodes.length)
            or.push({ emdCode: { in: emdCodes } });
        // 매물번호: exact number ("100412", "매물번호 100412").
        if (listingNo !== null)
            or.push({ listingNo });
        const where = { deletedAt: null, OR: or };
        const [rows, total] = await Promise.all([
            this.prisma.listing.findMany({
                where,
                select: listingSelect,
                orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
                take: limit,
            }),
            this.prisma.listing.count({ where }),
        ]);
        const names = await (0, admin_format_1.regionNames)(this.prisma, rows.map((r) => r.emdCode));
        const items = rows.map((l) => ({
            id: l.id,
            listingNo: (0, shared_1.formatListingNo)(l.listingNo),
            title: (0, admin_format_1.listingHeadline)(l),
            dealType: l.dealType,
            ...(0, admin_format_1.priceFields)(l.dealType, l),
            status: l.status,
            agencyName: l.primaryAgency.name,
            areaName: (l.emdCode && names.get(l.emdCode)) || null,
        }));
        return { total, items };
    }
    async agencies(query, variants, emdCodes, limit) {
        const or = variants.flatMap((v) => [
            { name: ci(v) },
            { representativeName: ci(v) },
            { roadAddress: ci(v) },
        ]);
        const key = registrationKeyOf(query);
        if (key.length >= 2)
            or.push({ registrationKey: { contains: key } });
        if (emdCodes.length)
            or.push({ emdCode: { in: emdCodes } });
        const where = { deletedAt: null, OR: or };
        const [rows, total] = await Promise.all([
            this.prisma.agency.findMany({
                where,
                select: agencySelect,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: limit,
            }),
            this.prisma.agency.count({ where }),
        ]);
        const names = await (0, admin_format_1.regionNames)(this.prisma, rows.map((r) => r.emdCode));
        const items = rows.map((a) => ({
            id: a.id,
            name: a.name,
            representativeName: a.representativeName,
            registrationNumber: a.registrationNumber,
            status: a.status,
            areaName: (a.emdCode && names.get(a.emdCode)) || null,
            listingCount: a.activeListingCount,
        }));
        return { total, items };
    }
    async users(query, variants, limit) {
        const or = variants.flatMap((v) => [
            { nickname: ci(v) },
            { name: ci(v) },
            { email: ci(v) },
        ]);
        const digits = (0, shared_1.normalizePhone)(query);
        if (/^[\d\s+()-]+$/.test(query) && digits.length >= 4)
            or.push({ phone: { contains: digits } });
        const where = { OR: or };
        const [rows, total] = await Promise.all([
            this.prisma.user.findMany({
                where,
                select: userSelect,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: limit,
            }),
            this.prisma.user.count({ where }),
        ]);
        const items = rows.map((u) => ({
            id: u.id,
            nickname: u.nickname ?? (0, admin_format_1.maskName)(u.name) ?? '(닉네임 없음)',
            name: (0, admin_format_1.maskName)(u.name),
            email: (0, shared_1.maskEmail)(u.email),
            phone: u.phone ? (0, shared_1.maskPhone)(u.phone) : null,
            role: u.role,
            status: u.status,
            provider: u.identities[0]?.provider ?? null,
            joinedAt: u.createdAt.toISOString(),
        }));
        return { total, items };
    }
};
exports.AdminSearchService = AdminSearchService;
exports.AdminSearchService = AdminSearchService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminSearchService);
//# sourceMappingURL=admin-search.service.js.map