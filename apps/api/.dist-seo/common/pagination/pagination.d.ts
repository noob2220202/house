import type { CursorPage, Paginated, PaginationQuery } from '@house/shared';
/** { page, pageSize } → Prisma { skip, take }. */
export declare function toSkipTake(q: PaginationQuery): {
    skip: number;
    take: number;
};
export declare function toPaginated<T>(items: T[], total: number, q: PaginationQuery): Paginated<T>;
/**
 * Runs count + page query in one transaction-less round trip pair:
 *   return paginate(q, (args) => prisma.notice.findMany({ where, orderBy, ...args }), () => prisma.notice.count({ where }));
 */
export declare function paginate<T>(q: PaginationQuery, findMany: (args: {
    skip: number;
    take: number;
}) => Promise<T[]>, count: () => Promise<number>): Promise<Paginated<T>>;
/** Opaque cursor encode/decode for keyset pagination (e.g. `${createdAt.toISOString()}|${id}`). */
export declare function encodeCursor(value: string): string;
export declare function decodeCursor(cursor: string | undefined): string | null;
/** Fetch `limit + 1` rows, then call this to build the page. */
export declare function toCursorPage<T>(rows: T[], limit: number, cursorOf: (row: T) => string): CursorPage<T>;
