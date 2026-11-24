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
var AdminAuditCoverageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAuditCoverageService = void 0;
const common_1 = require("@nestjs/common");
const constants_1 = require("@nestjs/common/constants");
const common_2 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const metadata_keys_1 = require("../../../common/decorators/metadata-keys");
function joinPath(...parts) {
    return parts
        .map((p) => (Array.isArray(p) ? (p[0] ?? '') : (p ?? '')))
        .flatMap((p) => p.split('/'))
        .filter(Boolean)
        .join('/');
}
/**
 * Inventory of every admin mutation route in the app (all modules) and whether it carries
 * @Audit. Logged once at bootstrap so a missing decorator is visible; AdminMutationAuditInterceptor
 * guarantees the audit row either way.
 */
let AdminAuditCoverageService = AdminAuditCoverageService_1 = class AdminAuditCoverageService {
    constructor(discovery, scanner, reflector) {
        this.discovery = discovery;
        this.scanner = scanner;
        this.reflector = reflector;
        this.logger = new common_1.Logger(AdminAuditCoverageService_1.name);
    }
    onApplicationBootstrap() {
        const undecorated = this.adminMutationRoutes().filter((r) => !r.decorated);
        if (undecorated.length > 0) {
            this.logger.log({ routes: undecorated.map((r) => `${r.method} /${r.path} (${r.controller}.${r.handler})`) }, 'admin mutations without @Audit (audited in service or by the fallback interceptor)');
        }
    }
    adminMutationRoutes() {
        const routes = [];
        for (const wrapper of this.discovery.getControllers()) {
            const instance = wrapper.instance;
            const metatype = wrapper.metatype;
            if (!instance || !metatype)
                continue;
            const base = this.reflector.get(constants_1.PATH_METADATA, metatype);
            if (!joinPath(base).startsWith('admin'))
                continue;
            const proto = Object.getPrototypeOf(instance);
            for (const name of this.scanner.getAllMethodNames(proto)) {
                const handler = proto[name];
                if (typeof handler !== 'function')
                    continue;
                const method = this.reflector.get(constants_1.METHOD_METADATA, handler);
                if (method === undefined ||
                    ![
                        common_2.RequestMethod.POST,
                        common_2.RequestMethod.PUT,
                        common_2.RequestMethod.PATCH,
                        common_2.RequestMethod.DELETE,
                    ].includes(method)) {
                    continue;
                }
                routes.push({
                    controller: metatype.name,
                    handler: name,
                    method: common_2.RequestMethod[method],
                    path: joinPath(base, this.reflector.get(constants_1.PATH_METADATA, handler)),
                    decorated: this.reflector.get(metadata_keys_1.AUDIT_KEY, handler) !== undefined,
                });
            }
        }
        return routes;
    }
};
exports.AdminAuditCoverageService = AdminAuditCoverageService;
exports.AdminAuditCoverageService = AdminAuditCoverageService = AdminAuditCoverageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [core_1.DiscoveryService,
        core_1.MetadataScanner,
        core_1.Reflector])
], AdminAuditCoverageService);
//# sourceMappingURL=admin-audit-coverage.service.js.map