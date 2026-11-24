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
exports.GeoController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const constants_1 = require("../constants");
const dto_1 = require("../dto");
const geocode_service_1 = require("../services/geocode.service");
/**
 * Address search with coordinates (중개사무소 등록 신청 주소). Signed-in users only: it proxies a
 * metered external API with the server's keys, so it is also rate-limited per account.
 */
let GeoController = class GeoController {
    constructor(geocode) {
        this.geocode = geocode;
    }
    search(q) {
        return this.geocode.search(q.query);
    }
};
exports.GeoController = GeoController;
__decorate([
    (0, common_1.Get)('geocode'),
    (0, throttler_1.Throttle)(constants_1.GEOCODE_THROTTLE),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.GeocodeQueryDto]),
    __metadata("design:returntype", Promise)
], GeoController.prototype, "search", null);
exports.GeoController = GeoController = __decorate([
    (0, swagger_1.ApiTags)('home'),
    (0, common_1.Controller)('geo'),
    __metadata("design:paramtypes", [geocode_service_1.GeocodeService])
], GeoController);
//# sourceMappingURL=geo.controller.js.map