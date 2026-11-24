"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sqmToPyeong = exports.SQM_PER_PYEONG = exports.pyeongToSqm = void 0;
exports.decimalSqmToPyeong = decimalSqmToPyeong;
exports.pyeongLabel = pyeongLabel;
const shared_1 = require("@house/shared");
Object.defineProperty(exports, "pyeongToSqm", { enumerable: true, get: function () { return shared_1.pyeongToSqm; } });
Object.defineProperty(exports, "SQM_PER_PYEONG", { enumerable: true, get: function () { return shared_1.SQM_PER_PYEONG; } });
Object.defineProperty(exports, "sqmToPyeong", { enumerable: true, get: function () { return shared_1.sqmToPyeong; } });
const decimal_1 = require("./decimal");
/** Decimal ㎡ column → 평 (1 decimal), null-safe. */
function decimalSqmToPyeong(sqm) {
    const n = (0, decimal_1.decimalToNumber)(sqm);
    return n === null ? null : (0, shared_1.sqmToPyeong)(n);
}
/** Label used for 평형 groups, e.g. 84.97㎡ → "25평". */
function pyeongLabel(sqm) {
    return `${Math.round(sqm / shared_1.SQM_PER_PYEONG)}평`;
}
//# sourceMappingURL=area.js.map