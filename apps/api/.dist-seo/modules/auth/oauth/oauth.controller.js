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
exports.OAuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const throttle_constants_1 = require("../../../common/throttle/throttle.constants");
const dto_1 = require("../dto");
const oauth_service_1 = require("./oauth.service");
/**
 * Fixed routes (registered in the Kakao / Naver / Google consoles):
 *   GET /api/v1/auth/oauth/{kakao|naver|google}/start
 *   GET /api/v1/auth/oauth/{kakao|naver|google}/callback
 */
let OAuthController = class OAuthController {
    constructor(oauth) {
        this.oauth = oauth;
    }
    async start(params, query, req, res) {
        const url = await this.oauth.start(params.provider, query, req, res);
        res.setHeader('Cache-Control', 'no-store');
        res.redirect(302, url);
    }
    async callback(params, query, req, res) {
        const url = await this.oauth.callback(params.provider, query, req, res);
        res.setHeader('Cache-Control', 'no-store');
        res.redirect(302, url);
    }
};
exports.OAuthController = OAuthController;
__decorate([
    (0, common_1.Get)(':provider/start'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.OAuthProviderParamDto,
        dto_1.OAuthStartQueryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], OAuthController.prototype, "start", null);
__decorate([
    (0, common_1.Get)(':provider/callback'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Req)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.OAuthProviderParamDto,
        dto_1.OAuthCallbackQueryDto, Object, Object]),
    __metadata("design:returntype", Promise)
], OAuthController.prototype, "callback", null);
exports.OAuthController = OAuthController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth/oauth'),
    (0, public_decorator_1.Public)(),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.AUTH),
    __metadata("design:paramtypes", [oauth_service_1.OAuthService])
], OAuthController);
//# sourceMappingURL=oauth.controller.js.map