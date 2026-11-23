import type { CursorPage, Paginated, PaginationQuery } from '@house/shared';

/** { page, pageSize } → Prisma { skip, take }. */
export function toSkipTake(q: PaginationQuery): { skip: number; take: number } {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export function toPaginated<T>(items: T[], total: number, q: PaginationQuery): Paginated<T> {
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
export async function paginate<T>(
  q: PaginationQuery,
  findMany: (args: { skip: number; take: number }) => Promise<T[]>,
  count: () => Promise<number>,
): Promise<Paginated<T>> {
  const [items, total] = await Promise.all([findMany(toSkipTake(q)), count()]);
  return toPaginated(items, total, q);
}

/** Opaque cursor encode/decode for keyset pagination (e.g. `${createdAt.toISOString()}|${id}`). */
export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string | undefined): string | null {
  if (!cursor) return null;
  try {
    return Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    return null;
  }
}

/** Fetch `limit + 1` rows, then call this to build the page. */
export function toCursorPage<T>(
  rows: T[],
  limit: number,
  cursorOf: (row: T) => string,
): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last !== undefined ? encodeCursor(cursorOf(last)) : null };
}
