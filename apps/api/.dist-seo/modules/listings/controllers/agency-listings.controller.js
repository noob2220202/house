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
exports.AgencyListingsController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("../../../common/decorators");
const throttle_constants_1 = require("../../../common/throttle/throttle.constants");
const dto_1 = require("../dto");
const agency_console_service_1 = require("../services/agency-console.service");
const agency_listings_service_1 = require("../services/agency-listings.service");
const co_brokerage_service_1 = require("../services/co-brokerage.service");
/** 중개사무소 매물 관리. Membership and ownership are checked in the services (404 if not ours). */
let AgencyListingsController = class AgencyListingsController {
    constructor(listings, coBrokerage, console) {
        this.listings = listings;
        this.coBrokerage = coBrokerage;
        this.console = console;
    }
    // Static routes before `:id`.
    /** Counters of the status tabs and reminder chips (실매물 확인 due, 광고 기간 ending, 공동중개). */
    summary(user) {
        return this.console.summary(user);
    }
    /** Other offices' public listings in a 단지 that this agency may ask to co-broker. */
    coBrokerCandidates(user, q) {
        return this.console.coBrokerCandidates(user, q);
    }
    list(user, q) {
        return this.listings.list(user, q);
    }
    create(user, dto) {
        return this.listings.create(user, dto);
    }
    get(user, p) {
        return this.listings.get(user, p.id);
    }
    update(user, p, dto) {
        return this.listings.update(user, p.id, dto);
    }
    remove(user, p) {
        return this.listings.remove(user, p.id);
    }
    publish(user, p) {
        return this.listings.publish(user, p.id);
    }
    changeStatus(user, p, dto) {
        return this.listings.changeStatus(user, p.id, dto);
    }
    addVerification(user, p, dto) {
        return this.listings.addVerification(user, p.id, dto);
    }
    replacePhotos(user, p, dto) {
        return this.listings.replacePhotos(user, p.id, dto);
    }
    /** The caller's agency requests to co-broker this listing (공동중개); the primary must accept. */
    joinCoBroker(user, p, dto) {
        return this.coBrokerage.join(user, p.id, dto);
    }
    /** The primary agency accepts a co-broker request (or takes back a removed agency). */
    acceptCoBroker(user, p) {
        return this.coBrokerage.accept(user, p.id, p.agencyId);
    }
    /** The primary agency rejects a pending co-broker request. */
    rejectCoBroker(user, p) {
        return this.coBrokerage.reject(user, p.id, p.agencyId);
    }
    /** The caller's agency leaves the co-brokerage (or cancels its pending request). */
    leaveCoBroker(user, p) {
        return this.coBrokerage.leave(user, p.id);
    }
    /** The primary agency removes a co-broker. */
    removeCoBroker(user, p) {
        return this.coBrokerage.removeAgency(user, p.id, p.agencyId);
    }
};
exports.AgencyListingsController = AgencyListingsController;
__decorate([
    (0, common_1.Get)('summary'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('co-broker-candidates'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CoBrokerCandidatesQueryDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "coBrokerCandidates", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyListingListQueryDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CreateListingDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "get", null);
__decorate([
    (0, common_1.Patch)(':id'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto,
        dto_1.UpdateListingDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':id/publish'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "publish", null);
__decorate([
    (0, common_1.Post)(':id/status'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto,
        dto_1.ListingStatusChangeDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "changeStatus", null);
__decorate([
    (0, common_1.Post)(':id/verifications'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto,
        dto_1.ListingVerificationDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "addVerification", null);
__decorate([
    (0, common_1.Put)(':id/photos'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto,
        dto_1.ListingPhotosDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "replacePhotos", null);
__decorate([
    (0, common_1.Post)(':id/co-brokers'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto,
        dto_1.CoBrokerJoinDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "joinCoBroker", null);
__decorate([
    (0, common_1.Post)(':id/co-brokers/:agencyId/accept'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CoBrokerParamDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "acceptCoBroker", null);
__decorate([
    (0, common_1.Post)(':id/co-brokers/:agencyId/reject'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CoBrokerParamDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "rejectCoBroker", null);
__decorate([
    (0, common_1.Delete)(':id/co-brokers'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "leaveCoBroker", null);
__decorate([
    (0, common_1.Delete)(':id/co-brokers/:agencyId'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.CoBrokerParamDto]),
    __metadata("design:returntype", Promise)
], AgencyListingsController.prototype, "removeCoBroker", null);
exports.AgencyListingsController = AgencyListingsController = __decorate([
    (0, swagger_1.ApiTags)('listings'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENT, shared_1.UserRole.AGENCY_OWNER),
    (0, common_1.Controller)('agency/listings'),
    __metadata("design:paramtypes", [agency_listings_service_1.AgencyListingsService,
        co_brokerage_service_1.CoBrokerageService,
        agency_console_service_1.AgencyConsoleService])
], AgencyListingsController);
//# sourceMappingURL=agency-listings.controller.js.map