"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRADE_SELECT = exports.AREA_TYPE_SELECT = exports.COMPLEX_SUMMARY_SELECT = void 0;
exports.isoDate = isoDate;
exports.areaTypeLabel = areaTypeLabel;
exports.toComplexSummary = toComplexSummary;
exports.toAreaTypeView = toAreaTypeView;
exports.toTradeView = toTradeView;
const shared_1 = require("@house/shared");
const area_1 = require("../../common/utils/area");
const decimal_1 = require("../../common/utils/decimal");
exports.COMPLEX_SUMMARY_SELECT = {
    id: true,
    name: true,
    assetType: true,
    roadAddress: true,
    jibunAddress: true,
    sggCode: true,
    emdCode: true,
    emdName: true,
    lat: true,
    lng: true,
    households: true,
    buildings: true,
    builtYear: true,
    approvalDate: true,
    activeListingCount: true,
    favoriteCount: true,
    viewCount: true,
};
exports.AREA_TYPE_SELECT = {
    id: true,
    exclusiveArea: true,
    supplyArea: true,
    typeName: true,
    pyeongLabel: true,
    households: true,
    rooms: true,
    baths: true,
};
exports.TRADE_SELECT = {
    id: true,
    dealType: true,
    dealDate: true,
    dealYm: true,
    exclusiveArea: true,
    areaTypeId: true,
    floor: true,
    price: true,
    deposit: true,
    monthlyRent: true,
    cancelled: true,
    cancelledAt: true,
    contractType: true,
};
function isoDate(d) {
    return d ? d.toISOString().slice(0, 10) : null;
}
/** 평형 label: explicit, else from 공급면적 (Korean 평형 convention), else from 전용면적. */
function areaTypeLabel(row) {
    if (row.pyeongLabel)
        return row.pyeongLabel;
    return (0, area_1.pyeongLabel)((0, decimal_1.decimalToNumber)(row.supplyArea ?? row.exclusiveArea) ?? 0);
}
function toComplexSummary(r) {
    return {
        id: r.id,
        name: r.name,
        assetType: r.assetType,
        roadAddress: r.roadAddress,
        jibunAddress: r.jibunAddress,
        sggCode: r.sggCode,
        emdCode: r.emdCode,
        emdName: r.emdName,
        lat: r.lat,
        lng: r.lng,
        households: r.households,
        buildings: r.buildings,
        builtYear: r.builtYear,
        approvalDate: isoDate(r.approvalDate),
        activeListingCount: r.activeListingCount,
        favoriteCount: r.favoriteCount,
        viewCount: r.viewCount,
    };
}
function toAreaTypeView(r) {
    const exclusiveArea = (0, decimal_1.decimalToNumber)(r.exclusiveArea) ?? 0;
    const supplyArea = (0, decimal_1.decimalToNumber)(r.supplyArea);
    return {
        id: r.id,
        exclusiveArea,
        supplyArea,
        exclusivePyeong: (0, shared_1.sqmToPyeong)(exclusiveArea),
        supplyPyeong: supplyArea === null ? null : (0, shared_1.sqmToPyeong)(supplyArea),
        typeName: r.typeName,
        pyeongLabel: areaTypeLabel(r),
        households: r.households,
        rooms: r.rooms,
        baths: r.baths,
    };
}
function toTradeView(r) {
    const exclusiveArea = (0, decimal_1.decimalToNumber)(r.exclusiveArea) ?? 0;
    return {
        id: r.id,
        dealType: r.dealType,
        dealDate: r.dealDate.toISOString().slice(0, 10),
        yearMonth: r.dealYm,
        exclusiveArea,
        exclusivePyeong: (0, shared_1.sqmToPyeong)(exclusiveArea),
        areaTypeId: r.areaTypeId,
        floor: r.floor,
        price: r.price,
        deposit: r.deposit,
        monthlyRent: r.monthlyRent,
        cancelled: r.cancelled,
        cancelledAt: isoDate(r.cancelledAt),
        contractType: r.contractType,
    };
}
//# sourceMappingURL=complex.mapper.js.map