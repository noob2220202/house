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
exports.MeController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const current_user_decorator_1 = require("../../../common/decorators/current-user.decorator");
const throttle_constants_1 = require("../../../common/throttle/throttle.constants");
const skip_terms_check_decorator_1 = require("../terms/skip-terms-check.decorator");
const dto_1 = require("../dto");
const account_service_1 = require("./account.service");
/**
 * The member's own account. Linking a provider starts at GET /auth/oauth/:provider/start?intent=link.
 * Exempt from TermsConsentGuard: agreeing to new terms happens here, and a member who does not
 * agree must still be able to correct or delete their data and withdraw.
 */
let MeController = class MeController {
    constructor(accounts) {
        this.accounts = accounts;
    }
    updateProfile(user, dto) {
        return this.accounts.updateProfile(user, dto);
    }
    identities(user) {
        return this.accounts.identities(user);
    }
    unlink(user, params) {
        return this.accounts.unlink(user, params.provider);
    }
    consents(user) {
        return this.accounts.consents(user);
    }
    updateConsents(user, dto) {
        return this.accounts.updateConsents(user, dto);
    }
    withdraw(user, dto, res) {
        return this.accounts.withdraw(user, dto, res);
    }
};
exports.MeController = MeController;
__decorate([
    (0, common_1.Patch)('profile'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Get)('identities'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "identities", null);
__decorate([
    (0, common_1.Delete)('identities/:provider'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.OAuthProviderParamDto]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "unlink", null);
__decorate([
    (0, common_1.Get)('consents'),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "consents", null);
__decorate([
    (0, common_1.Post)('consents'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.ConsentInputDto]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "updateConsents", null);
__decorate([
    (0, common_1.Post)('withdraw'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.AUTH),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.WithdrawDto, Object]),
    __metadata("design:returntype", Promise)
], MeController.prototype, "withdraw", null);
exports.MeController = MeController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('me'),
    (0, skip_terms_check_decorator_1.SkipTermsCheck)(),
    __metadata("design:paramtypes", [account_service_1.AccountService])
], MeController);
//# sourceMappingURL=me.controller.js.map