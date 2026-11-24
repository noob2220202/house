"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dateOnlyToDate = dateOnlyToDate;
exports.dateToDateOnly = dateToDateOnly;
exports.kstDayStart = kstDayStart;
exports.kstToday = kstToday;
exports.addDaysToDateOnly = addDaysToDateOnly;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
/** "YYYY-MM-DD" → Date at UTC midnight (for @db.Date columns). */
function dateOnlyToDate(value) {
    return new Date(`${value}T00:00:00.000Z`);
}
/** @db.Date column → "YYYY-MM-DD". */
function dateToDateOnly(value) {
    return value ? value.toISOString().slice(0, 10) : null;
}
/** "YYYY-MM-DD" (a KST calendar day) → the instant of that day's KST midnight. */
function kstDayStart(value) {
    return new Date(new Date(`${value}T00:00:00.000Z`).getTime() - KST_OFFSET_MS);
}
/** Today's date in Asia/Seoul as "YYYY-MM-DD". */
function kstToday(now = new Date()) {
    return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
/** "YYYY-MM-DD" + `days` calendar days. */
function addDaysToDateOnly(value, days) {
    return new Date(Date.parse(`${value}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
//# sourceMappingURL=dates.js.map