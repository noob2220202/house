"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.propertyStateFromInput = propertyStateFromInput;
exports.propertyStateFromRow = propertyStateFromRow;
exports.applyPropertyPatch = applyPropertyPatch;
exports.listingStateFromInput = listingStateFromInput;
exports.maintenanceFeeFromJson = maintenanceFeeFromJson;
exports.listingStateFromRow = listingStateFromRow;
exports.applyListingPatch = applyListingPatch;
exports.hasPropertyChanges = hasPropertyChanges;
exports.listingWriteColumns = listingWriteColumns;
exports.publishCheckInput = publishCheckInput;
const shared_1 = require("@house/shared");
const client_1 = require("@prisma/client");
const decimal_1 = require("../../../common/utils/decimal");
const dates_1 = require("./dates");
const search_columns_1 = require("./search-columns");
const orNull = (v) => (v === undefined ? null : v);
const dateOrNull = (v) => v === undefined || v === null ? null : (0, dates_1.dateOnlyToDate)(v);
function propertyStateFromInput(p, sggCode) {
    return {
        assetType: p.assetType,
        complexId: orNull(p.complexId),
        areaTypeId: orNull(p.areaTypeId),
        roadAddress: p.roadAddress,
        jibunAddress: orNull(p.jibunAddress),
        buildingName: orNull(p.buildingName),
        dong: orNull(p.dong),
        ho: orNull(p.ho),
        sggCode,
        emdCode: orNull(p.emdCode),
        lat: p.lat,
        lng: p.lng,
        floor: orNull(p.floor),
        totalFloors: orNull(p.totalFloors),
        exclusiveArea: orNull(p.exclusiveArea),
        supplyArea: orNull(p.supplyArea),
        landArea: orNull(p.landArea),
        totalFloorArea: orNull(p.totalFloorArea),
        rooms: orNull(p.rooms),
        roomType: orNull(p.roomType),
        baths: orNull(p.baths),
        direction: orNull(p.direction),
        directionBasis: orNull(p.directionBasis),
        approvalDate: dateOrNull(p.approvalDate),
        parkingSpaces: orNull(p.parkingSpaces),
        heatingType: orNull(p.heatingType),
        zoning: orNull(p.zoning),
        landCategory: orNull(p.landCategory),
        buildingUse: orNull(p.buildingUse),
    };
}
function propertyStateFromRow(p) {
    return {
        assetType: p.assetType,
        complexId: p.complexId,
        areaTypeId: p.areaTypeId,
        roadAddress: p.roadAddress,
        jibunAddress: p.jibunAddress,
        buildingName: p.buildingName,
        dong: p.dong,
        ho: p.ho,
        sggCode: p.sggCode,
        emdCode: p.emdCode,
        lat: p.lat,
        lng: p.lng,
        floor: p.floor,
        totalFloors: p.totalFloors,
        exclusiveArea: (0, decimal_1.decimalToNumber)(p.exclusiveArea),
        supplyArea: (0, decimal_1.decimalToNumber)(p.supplyArea),
        landArea: (0, decimal_1.decimalToNumber)(p.landArea),
        totalFloorArea: (0, decimal_1.decimalToNumber)(p.totalFloorArea),
        rooms: p.rooms,
        roomType: p.roomType,
        baths: p.baths,
        direction: p.direction,
        directionBasis: p.directionBasis,
        approvalDate: p.approvalDate,
        parkingSpaces: p.parkingSpaces,
        heatingType: p.heatingType,
        zoning: p.zoning,
        landCategory: p.landCategory,
        buildingUse: p.buildingUse,
    };
}
/** Applies a PATCH (undefined = keep, null = clear). `sggCode` is derived by the caller. */
function applyPropertyPatch(s, patch) {
    const next = { ...s };
    for (const [key, value] of Object.entries(patch)) {
        if (value === undefined)
            continue;
        if (key === 'approvalDate')
            next.approvalDate = dateOrNull(value);
        else
            next[key] = value;
    }
    return next;
}
function listingStateFromInput(d) {
    return {
        dealType: d.dealType,
        title: orNull(d.title),
        description: orNull(d.description),
        salePrice: orNull(d.salePrice),
        deposit: orNull(d.deposit),
        monthlyRent: orNull(d.monthlyRent),
        presalePrice: orNull(d.presalePrice),
        premium: orNull(d.premium),
        maintenanceFeeWon: orNull(d.maintenanceFeeWon),
        maintenanceFee: orNull(d.maintenanceFee),
        moveInType: orNull(d.moveInType),
        moveInDate: dateOrNull(d.moveInDate),
        floorDisplay: d.floorDisplay,
        options: d.options,
    };
}
/**
 * The stored JSON, validated against the shared schema. A row that no longer parses (hand-edited,
 * older shape) reads as "not entered", so publishing asks for the breakdown again.
 */
function maintenanceFeeFromJson(v) {
    if (v === null)
        return null;
    const parsed = shared_1.maintenanceFeeSchema.safeParse(v);
    return parsed.success ? parsed.data : null;
}
function listingStateFromRow(l) {
    return {
        dealType: l.dealType,
        title: l.title,
        description: l.description,
        salePrice: l.salePrice,
        deposit: l.deposit,
        monthlyRent: l.monthlyRent,
        presalePrice: l.presalePrice,
        premium: l.premium,
        maintenanceFeeWon: l.maintenanceFeeWon,
        maintenanceFee: maintenanceFeeFromJson(l.maintenanceFee),
        moveInType: l.moveInType,
        moveInDate: l.moveInDate,
        floorDisplay: l.floorDisplay,
        options: l.options,
    };
}
const LISTING_PATCH_KEYS = [
    'dealType',
    'title',
    'description',
    'salePrice',
    'deposit',
    'monthlyRent',
    'presalePrice',
    'premium',
    'maintenanceFeeWon',
    'maintenanceFee',
    'moveInType',
    'moveInDate',
    'floorDisplay',
    'options',
];
function applyListingPatch(s, patch) {
    const next = { ...s };
    for (const key of LISTING_PATCH_KEYS) {
        const value = patch[key];
        if (value === undefined)
            continue;
        if (key === 'moveInDate')
            next.moveInDate = dateOrNull(value);
        else
            next[key] = value;
    }
    return next;
}
/** True when the patch touches anything that a listing row derives from its property. */
function hasPropertyChanges(patch) {
    return !!patch && Object.values(patch).some((v) => v !== undefined);
}
/**
 * All listing columns derived from the two states (search columns + price sort key). Price fields
 * that don't apply to the deal type are nulled, so e.g. a 월세 listing switched to 매매 cannot keep
 * showing its old 월세 next to the 매매가.
 */
function listingWriteColumns(l, p, complexBuiltYear) {
    const prices = (0, shared_1.applicablePrices)(l.dealType, l);
    return {
        ...l,
        maintenanceFee: l.maintenanceFee ?? client_1.Prisma.DbNull,
        ...prices,
        ...(0, search_columns_1.propertySearchColumns)(p, complexBuiltYear),
        priceSort: (0, search_columns_1.listingPriceSort)(l.dealType, prices),
    };
}
function publishCheckInput(l, p, agency) {
    return {
        dealType: l.dealType,
        salePrice: l.salePrice,
        deposit: l.deposit,
        monthlyRent: l.monthlyRent,
        presalePrice: l.presalePrice,
        premium: l.premium,
        maintenanceFeeWon: l.maintenanceFeeWon,
        maintenanceFee: l.maintenanceFee,
        moveInType: l.moveInType,
        moveInDate: l.moveInDate,
        floorDisplay: l.floorDisplay,
        property: p,
        agency,
    };
}
//# sourceMappingURL=listing-state.js.map