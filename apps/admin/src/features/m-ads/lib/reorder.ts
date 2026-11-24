/** Moves the item at `from` to index `to` (both clamped); returns a new array. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(next.length, to)), 0, item as T);
  return next;
}

/**
 * Applies a new order of the VISIBLE rows to the full ordered id list of their group: the positions
 * the visible ids occupy in `full` are refilled in the new visible order; hidden ids (other pages,
 * filtered-out statuses) keep their positions.
 *   full [a,b,c,d,e], visible [d,b,c] → [a,d,b,c,e]
 * Visible ids missing from `full` are appended (the list changed meanwhile).
 */
export function mergeVisibleOrder(full: readonly string[], visible: readonly string[]): string[] {
  const known = new Set(full);
  const queue = visible.filter((id) => known.has(id));
  const visibleSet = new Set(queue);
  let i = 0;
  const merged = full.map((id) => (visibleSet.has(id) ? (queue[i++] as string) : id));
  return [...merged, ...visible.filter((id) => !known.has(id))];
}

/** Puts `id` at 1-based `position` of the ordered list (removing it first when present). */
export function placeAt(full: readonly string[], id: string, position: number): string[] {
  const rest = full.filter((x) => x !== id);
  const index = Math.max(0, Math.min(rest.length, Math.round(position) - 1));
  return [...rest.slice(0, index), id, ...rest.slice(index)];
}

export const sameOrder = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

/**
 * Neighbour to swap with when a row moves one step inside its group, or -1 when it is already at
 * the edge of the group (rows of other groups are never crossed).
 */
export function stepTarget<T>(
  rows: readonly T[],
  index: number,
  direction: -1 | 1,
  groupOf: (row: T) => string,
): number {
  const current = rows[index];
  const target = rows[index + direction];
  if (current === undefined || target === undefined) return -1;
  return groupOf(current) === groupOf(target) ? index + direction : -1;
}

/**
 * Optimistic counterpart of `mergeVisibleOrder` for the rows on screen: re-places the rows of one
 * group in `groupIds` order and hands the group's existing sortOrder numbers out in that order.
 */
export function applyGroupOrder<T extends { id: string; sortOrder: number }>(
  items: readonly T[],
  groupIds: readonly string[],
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  const queue = groupIds.map((id) => byId.get(id)).filter((item): item is T => item !== undefined);
  const inGroup = new Set(queue.map((item) => item.id));
  const orders = queue.map((item) => item.sortOrder).sort((a, b) => a - b);
  let i = 0;
  return items.map((item) => {
    if (!inGroup.has(item.id)) return item;
    const next = queue[i] as T;
    const sortOrder = orders[i] as number;
    i += 1;
    return { ...next, sortOrder };
  });
}
