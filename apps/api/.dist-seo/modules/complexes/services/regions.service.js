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
exports.RegionsService = void 0;
exports.toRegionView = toRegionView;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const audit_service_1 = require("../../../common/audit/audit.service");
const cache_service_1 = require("../../../common/cache/cache.service");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const suncheon_regions_data_1 = require("../regions/suncheon-regions.data");
const CODE_LENGTH_BY_LEVEL = {
    SIDO: shared_1.REGION_CODE_LENGTH.SIDO,
    SGG: shared_1.REGION_CODE_LENGTH.SGG,
    EMD: shared_1.REGION_CODE_LENGTH.EMD,
    RI: shared_1.REGION_CODE_LENGTH.FULL,
};
function toRegionView(r) {
    return {
        code: r.code,
        name: r.name,
        fullName: r.fullName,
        level: r.level,
        parentCode: r.parentCode,
        lat: r.lat,
        lng: r.lng,
        isActive: r.isActive,
    };
}
/**
 * 법정동 reference table (시도 → 시군구 → 읍면동 → 리) for the service region. Codes follow
 * 법정동코드 truncated per level (2/5/8/10 digits), so a child always starts with its parent.
 */
let RegionsService = class RegionsService {
    constructor(prisma, cache, config, audit) {
        this.prisma = prisma;
        this.cache = cache;
        this.config = config;
        this.audit = audit;
    }
    get sggCode() {
        return this.config.get('REGION_SGG_CODE');
    }
    async list(q) {
        const parentCode = q.parentCode ?? (q.level ? undefined : this.sggCode);
        const version = await this.cache.version(constants_1.COMPLEXES_CACHE.REGIONS);
        const key = `cache:complexes:regions:v${version}:${parentCode ?? '-'}:${q.level ?? '-'}:${q.includeInactive ? 1 : 0}`;
        return this.cache.getOrSet(key, constants_1.CACHE_TTL_SECONDS.REGIONS, async () => {
            const rows = await this.prisma.region.findMany({
                where: {
                    ...(parentCode ? { parentCode } : {}),
                    ...(q.level ? { level: q.level } : {}),
                    // Without a parent filter stay inside the service 시군구 (and its parents).
                    ...(parentCode
                        ? {}
                        : {
                            OR: [
                                { code: { startsWith: this.sggCode } },
                                { code: this.sggCode.slice(0, shared_1.REGION_CODE_LENGTH.SIDO) },
                            ],
                        }),
                    ...(q.includeInactive ? {} : { isActive: true }),
                },
                orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
                take: 1000,
            });
            return rows.map(toRegionView);
        });
    }
    async get(code) {
        const row = await this.prisma.region.findUnique({ where: { code } });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.REGION_NOT_FOUND);
        return toRegionView(row);
    }
    /** Active 읍면동/리 of the service 시군구 (autocomplete source; ~200 rows, cached). */
    async activeSubRegions() {
        const version = await this.cache.version(constants_1.COMPLEXES_CACHE.REGIONS);
        return this.cache.getOrSet(`cache:complexes:regions:v${version}:sub:${this.sggCode}`, constants_1.CACHE_TTL_SECONDS.REGIONS, async () => (await this.prisma.region.findMany({
            where: {
                code: { startsWith: this.sggCode },
                level: { in: [shared_1.RegionLevel.EMD, shared_1.RegionLevel.RI] },
                isActive: true,
            },
            orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
        })).map(toRegionView));
    }
    /** The 읍면동 row for a complex's emdCode; throws COMPLEX_REGION_INVALID outside the 시군구. */
    async requireServiceEmd(emdCode) {
        if (!emdCode.startsWith(this.sggCode)) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.COMPLEX_REGION_INVALID);
        }
        const row = await this.prisma.region.findUnique({ where: { code: emdCode } });
        if (!row || row.level !== shared_1.RegionLevel.EMD) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.COMPLEX_REGION_INVALID);
        }
        return row;
    }
    async upsert(code, input) {
        if (code.length !== CODE_LENGTH_BY_LEVEL[input.level]) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.VALIDATION_FAILED, [
                { path: 'level', code: 'custom', message: '지역 코드 길이와 단계가 맞지 않습니다.' },
            ]);
        }
        const parentCode = input.parentCode ?? null;
        if (input.level !== shared_1.RegionLevel.SIDO) {
            if (!parentCode || !code.startsWith(parentCode) || parentCode === code) {
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.REGION_PARENT_INVALID);
            }
            const parent = await this.prisma.region.findUnique({ where: { code: parentCode } });
            if (!parent)
                throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.REGION_PARENT_INVALID);
        }
        else if (parentCode) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.REGION_PARENT_INVALID);
        }
        const before = await this.prisma.region.findUnique({ where: { code } });
        request_context_1.RequestContext.setAuditBefore(before);
        const data = {
            name: input.name,
            fullName: input.fullName,
            level: input.level,
            parentCode,
            lat: input.lat ?? null,
            lng: input.lng ?? null,
            isActive: input.isActive,
            sortOrder: input.sortOrder,
        };
        const row = await this.prisma.region.upsert({
            where: { code },
            create: { code, ...data },
            update: data,
        });
        await this.cache.bump(constants_1.COMPLEXES_CACHE.REGIONS);
        return toRegionView(row);
    }
    /**
     * Idempotent upsert of the bundled 순천시 법정동 list. Names/levels/parents are refreshed;
     * admin-maintained columns (lat/lng, isActive) are left alone on existing rows.
     */
    async seedDefault() {
        if (this.sggCode !== suncheon_regions_data_1.SUNCHEON_SGG_CODE) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.REGION_SEED_UNAVAILABLE);
        }
        const rows = [
            {
                code: suncheon_regions_data_1.SUNCHEON_SIDO.code,
                name: suncheon_regions_data_1.SUNCHEON_SIDO.name,
                fullName: suncheon_regions_data_1.SUNCHEON_SIDO.name,
                level: shared_1.RegionLevel.SIDO,
                parentCode: null,
                sortOrder: 0,
            },
            {
                code: suncheon_regions_data_1.SUNCHEON_SGG_CODE,
                name: suncheon_regions_data_1.SUNCHEON_SGG.name,
                fullName: suncheon_regions_data_1.SUNCHEON_SGG.fullName,
                level: shared_1.RegionLevel.SGG,
                parentCode: suncheon_regions_data_1.SUNCHEON_SIDO.code,
                sortOrder: 0,
                lat: suncheon_regions_data_1.SUNCHEON_SGG.lat,
                lng: suncheon_regions_data_1.SUNCHEON_SGG.lng,
            },
        ];
        const emdNames = new Map();
        suncheon_regions_data_1.SUNCHEON_REGIONS.forEach(([code, name], i) => {
            const isEmd = code.length === shared_1.REGION_CODE_LENGTH.EMD;
            if (isEmd)
                emdNames.set(code, name);
            const parentCode = isEmd ? suncheon_regions_data_1.SUNCHEON_SGG_CODE : code.slice(0, shared_1.REGION_CODE_LENGTH.EMD);
            const emdName = isEmd ? '' : `${emdNames.get(parentCode) ?? ''} `;
            rows.push({
                code,
                name,
                fullName: `${suncheon_regions_data_1.SUNCHEON_SGG.fullName} ${emdName}${name}`.replace(/\s+/g, ' '),
                level: isEmd ? shared_1.RegionLevel.EMD : shared_1.RegionLevel.RI,
                parentCode,
                sortOrder: i + 1,
            });
        });
        // Parents first (array order), in one transaction.
        await this.prisma.$transaction(rows.map((r) => this.prisma.region.upsert({
            where: { code: r.code },
            create: r,
            update: {
                name: r.name,
                fullName: r.fullName,
                level: r.level,
                parentCode: r.parentCode,
                sortOrder: r.sortOrder,
            },
        })));
        await this.audit.record({
            action: 'region.seed',
            resourceType: 'Region',
            resourceId: suncheon_regions_data_1.SUNCHEON_SGG_CODE,
            after: { upserted: rows.length },
        });
        await this.cache.bump(constants_1.COMPLEXES_CACHE.REGIONS);
        return { upserted: rows.length };
    }
};
exports.RegionsService = RegionsService;
exports.RegionsService = RegionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService,
        app_config_service_1.AppConfig,
        audit_service_1.AuditService])
], RegionsService);
//# sourceMappingURL=regions.service.js.map