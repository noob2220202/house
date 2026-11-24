"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kstDay = kstDay;
exports.addDays = addDays;
exports.dayToDate = dayToDate;
exports.dailyViews = dailyViews;
exports.listingSummaryText = listingSummaryText;
exports.dashboardPrice = dashboardPrice;
exports.toDashboardListing = toDashboardListing;
const shared_1 = require("@house/shared");
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** KST calendar day "YYYY-MM-DD" of an instant. */
function kstDay(at) {
    return new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
/** "YYYY-MM-DD" shifted by `days`. */
function addDays(day, days) {
    return new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY_MS).toISOString().slice(0, 10);
}
/** "YYYY-MM-DD" → Date at UTC midnight (for @db.Date columns). */
function dayToDate(day) {
    return new Date(`${day}T00:00:00.000Z`);
}
/**
 * Views per day from cumulative snapshots (`day → total listing views`): views(D) =
 * snap(D) − snap(D−1), clamped at 0 (a listing leaving the agency lowers the sum). A day whose own
 * or previous snapshot is missing counts 0 — the all-time total never lands on one day.
 */
function dailyViews(snapshots, today) {
    const viewsOn = (day) => {
        const cur = snapshots.get(day);
        const prev = snapshots.get(addDays(day, -1));
        return cur === undefined || prev === undefined ? 0 : Math.max(0, cur - prev);
    };
    const daily = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i - 6);
        return { date, views: viewsOn(date) };
    });
    const total7d = daily.reduce((sum, d) => sum + d.views, 0);
    // The previous week is only comparable when both of its ends were observed.
    const prevKnown = snapshots.has(addDays(today, -7)) && snapshots.has(addDays(today, -14));
    const prevTotal = Array.from({ length: 7 }, (_, i) => viewsOn(addDays(today, i - 13))).reduce((a, b) => a + b, 0);
    const changeRatio = prevKnown && prevTotal > 0
        ? Math.round(((total7d - prevTotal) / prevTotal) * 1000) / 1000
        : null;
    return { total7d, changeRatio, daily };
}
/** "34평 · 5/15층": 평 from 공급면적 (else 전용), floor as the agency may show it. */
function listingSummaryText(r) {
    const area = r.property.supplyArea ?? r.property.exclusiveArea;
    const parts = [
        area ? `${Math.round((0, shared_1.sqmToPyeong)(area))}평` : null,
        (0, shared_1.floorLabel)(r.property.floor, r.property.totalFloors, r.floorDisplay),
    ].filter((p) => !!p);
    return parts.length > 0 ? parts.join(' · ') : null;
}
/**
 * Price fields as the console shows them (만원): 매매 / 분양권 (분양가 + 프리미엄) → `price`,
 * 전세 → `deposit`, 월세 → `deposit` + `monthlyRent`.
 */
function dashboardPrice(r) {
    switch (r.dealType) {
        case shared_1.DealType.SALE:
            return { price: r.salePrice, deposit: null, monthlyRent: null };
        case shared_1.DealType.PRESALE:
            return {
                price: r.presalePrice === null ? null : r.presalePrice + (r.premium ?? 0),
                deposit: null,
                monthlyRent: null,
            };
        case shared_1.DealType.JEONSE:
            return { price: null, deposit: r.deposit, monthlyRent: null };
        case shared_1.DealType.MONTHLY:
        default:
            return { price: null, deposit: r.deposit, monthlyRent: r.monthlyRent };
    }
}
/**
 * `verificationValidDays` after the last 실매물 확인 the badge (and, here, the ad period) lapses
 * unless the listing is verified again. KST date; null when never verified.
 */
function toDashboardListing(r, verificationValidDays) {
    return {
        id: r.id,
        title: r.title ??
            r.complex?.name ??
            `${shared_1.ASSET_TYPE_LABEL[r.assetType]} ${shared_1.DEAL_TYPE_LABEL[r.dealType]}`,
        summary: listingSummaryText(r),
        dealType: r.dealType,
        ...dashboardPrice(r),
        expiresAt: r.expiresAt?.toISOString() ?? null,
        verifiedAt: r.verifiedAt?.toISOString() ?? null,
        verificationDueAt: r.verifiedAt ? addDays(kstDay(r.verifiedAt), verificationValidDays) : null,
    };
}
//# sourceMappingURL=dashboard.js.map