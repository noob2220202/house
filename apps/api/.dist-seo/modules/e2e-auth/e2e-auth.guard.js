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
exports.E2eOnlyGuard = void 0;
const common_1 = require("@nestjs/common");
const app_config_service_1 = require("../../config/app-config.service");
/**
 * Defense in depth for the e2e login: even if the module were imported by mistake, every request
 * answers 404 unless the validated config says NODE_ENV=test and E2E_FAKE_OAUTH=1.
 */
let E2eOnlyGuard = class E2eOnlyGuard {
    constructor(config) {
        this.config = config;
    }
    canActivate() {
        if (this.config.isTest && this.config.get('E2E_FAKE_OAUTH') === true)
            return true;
        throw new common_1.NotFoundException();
    }
};
exports.E2eOnlyGuard = E2eOnlyGuard;
exports.E2eOnlyGuard = E2eOnlyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [app_config_service_1.AppConfig])
], E2eOnlyGuard);
//# sourceMappingURL=e2e-auth.guard.js.map