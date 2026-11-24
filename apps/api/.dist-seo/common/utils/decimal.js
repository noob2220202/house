"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decimalToNumber = decimalToNumber;
const client_1 = require("@prisma/client");
/** Prisma Decimal → number for API responses (areas/ratios; never for money, which is Int 만원). */
function decimalToNumber(value) {
    if (value === null || value === undefined)
        return null;
    if (typeof value === 'number')
        return value;
    return new client_1.Prisma.Decimal(value).toNumber();
}
//# sourceMappingURL=decimal.js.map