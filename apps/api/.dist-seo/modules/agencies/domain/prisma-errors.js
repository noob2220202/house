"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUniqueViolation = isUniqueViolation;
const client_1 = require("@prisma/client");
/** P2002 unique violation (optionally on a column/field whose name contains `field`). */
function isUniqueViolation(err, field) {
    if (!(err instanceof client_1.Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002')
        return false;
    if (!field)
        return true;
    const target = err.meta?.target;
    const names = Array.isArray(target)
        ? target.map((t) => String(t))
        : typeof target === 'string'
            ? [target]
            : [];
    const snake = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    return names.some((n) => n.includes(field) || n.includes(snake));
}
//# sourceMappingURL=prisma-errors.js.map