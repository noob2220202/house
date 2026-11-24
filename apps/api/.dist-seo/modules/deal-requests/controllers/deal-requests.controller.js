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
exports.MyDealRequestsController = exports.DealRequestsController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("../../../common/decorators");
const zod_validation_pipe_1 = require("../../../common/pipes/zod-validation.pipe");
const throttle_constants_1 = require("../../../common/throttle/throttle.constants");
const dto_1 = require("../dto");
const deal_requests_service_1 = require("../services/deal-requests.service");
const request_form_service_1 = require("../services/request-form.service");
/** 내놓기/구하기 registration (login required; no phone verification — contact is typed). */
let DealRequestsController = class DealRequestsController {
    constructor(requests, form) {
        this.requests = requests;
        this.form = form;
    }
    /** Offices a request for the area reaches (`total`) + the "선택한 중개사" picker (`q`). Public. */
    targetAgencies(q) {
        return this.form.targetAgencies(q);
    }
    /** Registered complex (평형, 시세 hints) of a postcode result. Public. */
    addressMatch(q) {
        return this.form.addressMatch(q);
    }
    create(user, dto) {
        return this.requests.create(user, dto);
    }
};
exports.DealRequestsController = DealRequestsController;
__decorate([
    (0, common_1.Get)('target-agencies'),
    (0, decorators_1.Public)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.TargetAgencyQueryDto]),
    __metadata("design:returntype", Promise)
], DealRequestsController.prototype, "targetAgencies", null);
__decorate([
    (0, common_1.Get)('address-match'),
    (0, decorators_1.Public)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.AddressMatchQueryDto]),
    __metadata("design:returntype", Promise)
], DealRequestsController.prototype, "addressMatch", null);
__decorate([
    (0, common_1.Post)(),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.DEAL_REQUEST),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(new zod_validation_pipe_1.ZodValidationPipe(shared_1.dealRequestCreateSchema))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], DealRequestsController.prototype, "create", null);
exports.DealRequestsController = DealRequestsController = __decorate([
    (0, swagger_1.ApiTags)('deal-requests'),
    (0, common_1.Controller)('deal-requests'),
    __metadata("design:paramtypes", [deal_requests_service_1.DealRequestsService,
        request_form_service_1.RequestFormService])
], DealRequestsController);
/** The requester's own requests (/api/v1/me/deal-requests). Not-owned ids answer 404. */
let MyDealRequestsController = class MyDealRequestsController {
    constructor(requests) {
        this.requests = requests;
    }
    list(user, q) {
        return this.requests.listMine(user, q);
    }
    get(user, p) {
        return this.requests.getMine(user, p.id);
    }
    cancel(user, p) {
        return this.requests.cancel(user, p.id);
    }
    /** OPEN → expiry pushed out by TTL_DAYS; EXPIRED → OPEN again (limited number of times). */
    extend(user, p) {
        return this.requests.extend(user, p.id);
    }
    close(user, p, dto) {
        return this.requests.close(user, p.id, dto);
    }
    grant(user, p, dto) {
        return this.requests.grantContact(user, p.id, dto.agencyId);
    }
    revoke(user, p) {
        return this.requests.revokeContact(user, p.id, p.agencyId);
    }
};
exports.MyDealRequestsController = MyDealRequestsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.MyDealRequestListQueryDto]),
    __metadata("design:returntype", Promise)
], MyDealRequestsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], MyDealRequestsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], MyDealRequestsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Post)(':id/extend'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], MyDealRequestsController.prototype, "extend", null);
__decorate([
    (0, common_1.Post)(':id/close'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto,
        dto_1.DealRequestCloseDto]),
    __metadata("design:returntype", Promise)
], MyDealRequestsController.prototype, "close", null);
__decorate([
    (0, common_1.Post)(':id/contact-grants'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto,
        dto_1.ContactGrantDto]),
    __metadata("design:returntype", Promise)
], MyDealRequestsController.prototype, "grant", null);
__decorate([
    (0, common_1.Delete)(':id/contact-grants/:agencyId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.ContactGrantParamDto]),
    __metadata("design:returntype", Promise)
], MyDealRequestsController.prototype, "revoke", null);
exports.MyDealRequestsController = MyDealRequestsController = __decorate([
    (0, swagger_1.ApiTags)('deal-requests'),
    (0, common_1.Controller)('me/deal-requests'),
    __metadata("design:paramtypes", [deal_requests_service_1.DealRequestsService])
], MyDealRequestsController);
//# sourceMappingURL=deal-requests.controller.js.map