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
exports.SiteSettingsService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const cache_service_1 = require("../../../common/cache/cache.service");
const request_context_1 = require("../../../common/context/request-context");
const app_exception_1 = require("../../../common/errors/app.exception");
const zod_issues_1 = require("../../../common/errors/zod-issues");
const prisma_service_1 = require("../../../prisma/prisma.service");
const constants_1 = require("../constants");
const ALL_KEYS = Object.values(shared_1.SiteSettingKey);
const settingSelect = {
    key: true,
    value: true,
    updatedAt: true,
    updatedByAdmin: { select: { id: true, name: true } },
};
function toView(key, row) {
    return {
        key,
        value: row?.value ?? null,
        updatedAt: row?.updatedAt.toISOString() ?? null,
        updatedBy: row?.updatedByAdmin ?? null,
        updatedByAdminName: row?.updatedByAdmin?.name ?? null,
    };
}
/**
 * Key/value site settings (사업자 정보, 고객센터, SEO, 기능, 푸터). Values are validated by
 * `siteSettingSchemas[key]` on write. The public bundle is cached and invalidated on every write.
 */
let SiteSettingsService = class SiteSettingsService {
    constructor(prisma, cache) {
        this.prisma = prisma;
        this.cache = cache;
    }
    async publicSettings() {
        const v = await this.cache.version(constants_1.ADMIN_CACHE.SITE_SETTINGS);
        return this.cache.getOrSet(`cache:admin:site-settings:public:v${v}`, constants_1.SITE_SETTINGS_CACHE_TTL_SECONDS, async () => {
            const rows = await this.prisma.siteSetting.findMany({
                where: { key: { in: [...shared_1.PUBLIC_SITE_SETTING_KEYS] } },
                select: { key: true, value: true },
            });
            const out = {};
            for (const r of rows)
                out[r.key] = r.value;
            return out;
        });
    }
    async list() {
        const rows = await this.prisma.siteSetting.findMany({ select: settingSelect });
        const byKey = new Map(rows.map((r) => [r.key, r]));
        return ALL_KEYS.map((k) => toView(k, byKey.get(k)));
    }
    async get(key) {
        const row = await this.prisma.siteSetting.findUnique({ where: { key }, select: settingSelect });
        return toView(key, row ?? undefined);
    }
    async put(key, value, admin) {
        const parsed = shared_1.siteSettingSchemas[key].safeParse(value);
        if (!parsed.success) {
            throw app_exception_1.AppException.badRequest(shared_1.ErrorCode.SETTING_INVALID, (0, zod_issues_1.formatZodIssues)(parsed.error));
        }
        request_context_1.RequestContext.setAuditBefore(await this.get(key));
        const json = parsed.data;
        const row = await this.prisma.siteSetting.upsert({
            where: { key },
            create: { key, value: json, updatedByAdminId: admin.adminId },
            update: { value: json, updatedByAdminId: admin.adminId },
            select: settingSelect,
        });
        await this.cache.bump(constants_1.ADMIN_CACHE.SITE_SETTINGS);
        return toView(key, row);
    }
};
exports.SiteSettingsService = SiteSettingsService;
exports.SiteSettingsService = SiteSettingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        cache_service_1.CacheService])
], SiteSettingsService);
//# sourceMappingURL=site-settings.service.js.map