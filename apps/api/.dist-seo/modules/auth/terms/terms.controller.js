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
exports.TermsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const public_decorator_1 = require("../../../common/decorators/public.decorator");
const dto_1 = require("../dto");
const terms_service_1 = require("./terms.service");
/** Published terms (이용약관, 개인정보처리방침, 위치기반서비스 이용약관, 마케팅 수신). */
let TermsController = class TermsController {
    constructor(terms) {
        this.terms = terms;
    }
    list() {
        return this.terms.listCurrent();
    }
    /** Current version of a type (`service`, `privacy`, …), or `?version=` for a past one. */
    get(params, q) {
        return this.terms.getByType(params.type, q.version);
    }
    /** Published versions of a type, newest first (no content); `isCurrent` = in force now. */
    versions(params) {
        return this.terms.versions(params.type);
    }
    /** One published version (same as `GET /terms/:type?version=`). */
    version(params) {
        return this.terms.getByType(params.type, params.version);
    }
};
exports.TermsController = TermsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TermsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':type'),
    __param(0, (0, common_1.Param)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.TermsTypeParamDto, dto_1.TermsVersionQueryDto]),
    __metadata("design:returntype", Promise)
], TermsController.prototype, "get", null);
__decorate([
    (0, common_1.Get)(':type/versions'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.TermsTypeParamDto]),
    __metadata("design:returntype", Promise)
], TermsController.prototype, "versions", null);
__decorate([
    (0, common_1.Get)(':type/versions/:version'),
    __param(0, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.TermsVersionParamDto]),
    __metadata("design:returntype", Promise)
], TermsController.prototype, "version", null);
exports.TermsController = TermsController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('terms'),
    (0, public_decorator_1.Public)(),
    __metadata("design:paramtypes", [terms_service_1.TermsService])
], TermsController);
//# sourceMappingURL=terms.controller.js.map