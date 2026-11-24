"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2eAuthModule = void 0;
const common_1 = require("@nestjs/common");
const e2e_auth_controller_1 = require("./e2e-auth.controller");
const e2e_auth_enabled_1 = require("./e2e-auth.enabled");
const e2e_auth_guard_1 = require("./e2e-auth.guard");
const e2e_auth_service_1 = require("./e2e-auth.service");
/**
 * TEST-ONLY. AppModule imports this only when e2eFakeAuthEnabled() (NODE_ENV=test and
 * E2E_FAKE_OAUTH=1). Depends on AuthModule's global exports (UserSessionService, TermsService).
 */
let E2eAuthModule = class E2eAuthModule {
    onModuleInit() {
        if (!(0, e2e_auth_enabled_1.e2eFakeAuthEnabled)()) {
            throw new Error('E2eAuthModule must only be loaded with NODE_ENV=test and E2E_FAKE_OAUTH=1');
        }
    }
};
exports.E2eAuthModule = E2eAuthModule;
exports.E2eAuthModule = E2eAuthModule = __decorate([
    (0, common_1.Module)({
        controllers: [e2e_auth_controller_1.E2eAuthController],
        providers: [e2e_auth_service_1.E2eAuthService, e2e_auth_guard_1.E2eOnlyGuard],
    })
], E2eAuthModule);
//# sourceMappingURL=e2e-auth.module.js.map