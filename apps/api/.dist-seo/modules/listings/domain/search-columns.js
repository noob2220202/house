"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertySearchColumns = propertySearchColumns;
exports.listingPriceSort = listingPriceSort;
const shared_1 = require("@house/shared");
/** Columns copied from the property onto every listing of it (kept in sync on every write). */
function propertySearchColumns(p, complexBuiltYear) {
    return {
        assetType: p.assetType,
        complexId: p.complexId,
        sggCode: p.sggCode,
        emdCode: p.emdCode,
        lat: p.lat,
        lng: p.lng,
        exclusiveArea: (0, shared_1.searchAreaOf)(p),
        rooms: p.rooms,
        roomType: (0, shared_1.effectiveRoomType)(p.assetType, p.roomType, p.rooms),
        landZone: (0, shared_1.landZoneOf)(p.zoning),
        landCategory: (0, shared_1.landCategoryOf)(p.landCategory),
        baths: p.baths,
        direction: p.direction,
        floorClass: (0, shared_1.floorClassOf)(p.floor, p.totalFloors),
        builtYear: p.approvalDate ? p.approvalDate.getUTCFullYear() : complexBuiltYear,
    };
}
function listingPriceSort(dealType, prices) {
    return (0, shared_1.priceSortOf)(dealType, prices);
}
//# sourceMappingURL=search-columns.js.map