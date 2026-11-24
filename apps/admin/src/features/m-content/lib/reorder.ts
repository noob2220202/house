/** Returns a copy of `list` with the item at `from` moved to `to` (out-of-range → unchanged copy). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  if (from === to || from < 0 || to < 0 || from >= next.length || to >= next.length) return next;
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** Moves the item with `id` one step up (-1) or down (+1). */
export function moveById<T extends { id: string }>(
  list: readonly T[],
  id: string,
  delta: -1 | 1,
): T[] {
  const index = list.findIndex((item) => item.id === id);
  return moveItem(list, index, index + delta);
}

/** True when both lists hold the same ids in the same order. */
export function sameOrder(a: readonly { id: string }[], b: readonly { id: string }[]): boolean {
  return a.length === b.length && a.every((item, i) => item.id === b[i]?.id);
}
