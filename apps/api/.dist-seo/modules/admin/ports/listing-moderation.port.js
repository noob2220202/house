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
exports.ListingModerationAdapter = exports.LISTING_MODERATION = void 0;
const common_1 = require("@nestjs/common");
const listings_moderation_service_1 = require("../../listings/services/listings-moderation.service");
exports.LISTING_MODERATION = Symbol('ADMIN_LISTING_MODERATION');
/** Adapter over ListingsModerationService (exported by ListingsModule). */
let ListingModerationAdapter = class ListingModerationAdapter {
    constructor(moderation) {
        this.moderation = moderation;
    }
    async hide(listingId, reason, tx) {
        await this.moderation.hide(listingId, reason, tx);
    }
    unhide(listingId) {
        return this.moderation.unhide(listingId);
    }
    async forceClose(listingId, reason) {
        await this.moderation.close(listingId, reason);
    }
    invalidateSearch() {
        return this.moderation.invalidateSearch();
    }
};
exports.ListingModerationAdapter = ListingModerationAdapter;
exports.ListingModerationAdapter = ListingModerationAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [listings_moderation_service_1.ListingsModerationService])
], ListingModerationAdapter);
//# sourceMappingURL=listing-moderation.port.js.map