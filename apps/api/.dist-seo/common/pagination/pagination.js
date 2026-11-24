"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSkipTake = toSkipTake;
exports.toPaginated = toPaginated;
exports.paginate = paginate;
exports.encodeCursor = encodeCursor;
exports.decodeCursor = decodeCursor;
exports.toCursorPage = toCursorPage;
/** { page, pageSize } → Prisma { skip, take }. */
function toSkipTake(q) {
    return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}
function toPaginated(items, total, q) {
    return {
        items,
        page: q.page,
        pageSize: q.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
    };
}
/**
 * Runs count + page query in one transaction-less round trip pair:
 *   return paginate(q, (args) => prisma.notice.findMany({ where, orderBy, ...args }), () => prisma.notice.count({ where }));
 */
async function paginate(q, findMany, count) {
    const [items, total] = await Promise.all([findMany(toSkipTake(q)), count()]);
    return toPaginated(items, total, q);
}
/** Opaque cursor encode/decode for keyset pagination (e.g. `${createdAt.toISOString()}|${id}`). */
function encodeCursor(value) {
    return Buffer.from(value, 'utf8').toString('base64url');
}
function decodeCursor(cursor) {
    if (!cursor)
        return null;
    try {
        return Buffer.from(cursor, 'base64url').toString('utf8');
    }
    catch {
        return null;
    }
}
/** Fetch `limit + 1` rows, then call this to build the page. */
function toCursorPage(rows, limit, cursorOf) {
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const last = items[items.length - 1];
    return { items, nextCursor: hasMore && last !== undefined ? encodeCursor(cursorOf(last)) : null };
}
//# sourceMappingURL=pagination.js.map