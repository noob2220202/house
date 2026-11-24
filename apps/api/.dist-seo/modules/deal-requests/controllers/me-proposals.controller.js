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
exports.MyProposalsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("../../../common/decorators");
const throttle_constants_1 = require("../../../common/throttle/throttle.constants");
const dto_1 = require("../dto");
const proposals_service_1 = require("../services/proposals.service");
/** The requester answering proposals on their own requests (/api/v1/me/proposals). */
let MyProposalsController = class MyProposalsController {
    constructor(proposals) {
        this.proposals = proposals;
    }
    accept(user, p, dto) {
        return this.proposals.accept(user, p.id, dto);
    }
    decline(user, p) {
        return this.proposals.decline(user, p.id);
    }
};
exports.MyProposalsController = MyProposalsController;
__decorate([
    (0, common_1.Post)(':id/accept'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto,
        dto_1.ProposalAcceptDto]),
    __metadata("design:returntype", Promise)
], MyProposalsController.prototype, "accept", null);
__decorate([
    (0, common_1.Post)(':id/decline'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], MyProposalsController.prototype, "decline", null);
exports.MyProposalsController = MyProposalsController = __decorate([
    (0, swagger_1.ApiTags)('deal-requests'),
    (0, common_1.Controller)('me/proposals'),
    __metadata("design:paramtypes", [proposals_service_1.ProposalsService])
], MyProposalsController);
//# sourceMappingURL=me-proposals.controller.js.map