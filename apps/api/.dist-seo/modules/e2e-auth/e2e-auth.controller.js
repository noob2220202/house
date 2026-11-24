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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2eAuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../../common/decorators/public.decorator");
const skip_csrf_decorator_1 = require("../../common/decorators/skip-csrf.decorator");
const skip_terms_check_decorator_1 = require("../auth/terms/skip-terms-check.decorator");
const e2e_auth_dto_1 = require("./e2e-auth.dto");
const e2e_auth_guard_1 = require("./e2e-auth.guard");
const e2e_auth_service_1 = require("./e2e-auth.service");
/**
 * TEST-ONLY login for the browser e2e harness (`POST /api/v1/e2e/login`). Registered only when
 * NODE_ENV=test and E2E_FAKE_OAUTH=1 (see e2e-auth.enabled.ts); 404 otherwise.
 * CSRF is skipped because the test runner calls it from a fresh API request context (no page,
 * no Origin); it can only ever exist on a NODE_ENV=test server.
 */
let E2eAuthController = class E2eAuthController {
    constructor(service) {
        this.service = service;
    }
    login(dto, req, res) {
        return this.service.login(dto, req, res);
    }
};
exports.E2eAuthController = E2eAuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [e2e_auth_dto_1.E2eLoginDto, Object, Object]),
    __metadata("design:returntype", Promise)
], E2eAuthController.prototype, "login", null);
exports.E2eAuthController = E2eAuthController = __decorate([
    (0, swagger_1.ApiExcludeController)(),
    (0, common_1.Controller)('e2e'),
    (0, common_1.UseGuards)(e2e_auth_guard_1.E2eOnlyGuard),
    (0, public_decorator_1.Public)(),
    (0, skip_csrf_decorator_1.SkipCsrf)(),
    (0, skip_terms_check_decorator_1.SkipTermsCheck)(),
    __metadata("design:paramtypes", [e2e_auth_service_1.E2eAuthService])
], E2eAuthController);
//# sourceMappingURL=e2e-auth.controller.js.map