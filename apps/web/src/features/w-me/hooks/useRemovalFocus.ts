'use client';
import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * Keeps keyboard focus in a list whose rows disappear when their own control is activated
 * (favourite hearts, "읽음" rows). Without it the focused control unmounts, focus falls back to
 * <body> and a keyboard user restarts from the skip link.
 *
 *   const focus = useRemovalFocus(ids, () => fallbackRef.current);
 *   <button ref={focus.register(id)} onClick={() => { focus.willRemove(id); remove(id); }} />
 *
 * After the row is gone, focus moves to the control of the row that took its place (the next one,
 * or the previous one when it was last); with no rows left it moves to `fallback()`.
 */
export function useRemovalFocus(
  ids: readonly string[],
  fallback: () => HTMLElement | null | undefined,
) {
  const controls = useRef(new Map<string, HTMLElement>());
  const pending = useRef<{ removed: string; next: string | null } | null>(null);
  const idsRef = useRef(ids);
  idsRef.current = ids;
  const fallbackRef = useRef(fallback);
  fallbackRef.current = fallback;

  const register = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) controls.current.set(id, el);
      else controls.current.delete(id);
    },
    [],
  );

  /** Call right before removing row `id`. Only arms when that row's control has the focus. */
  const willRemove = useCallback((id: string) => {
    const el = controls.current.get(id);
    if (!el || document.activeElement !== el) return;
    const list = idsRef.current;
    const index = list.indexOf(id);
    pending.current = { removed: id, next: list[index + 1] ?? list[index - 1] ?? null };
  }, []);

  const key = ids.join('\n');
  useLayoutEffect(() => {
    const p = pending.current;
    if (!p || idsRef.current.includes(p.removed)) return;
    pending.current = null;
    // The user moved on by themselves (clicked or tabbed elsewhere): leave their focus alone.
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const target = (p.next ? controls.current.get(p.next) : null) ?? fallbackRef.current();
    target?.focus();
  }, [key]);

  /**
   * Puts focus back into the list when it was lost with an element that left the DOM (the notice
   * row of a restored card, …): on row `id` when it is on screen, else on `fallback()`, else on the
   * first row. Does nothing while the user's focus is somewhere real.
   */
  const refocus = useCallback((id?: string) => {
    const active = document.activeElement;
    if (active && active !== document.body && active.isConnected) return;
    const first = idsRef.current[0];
    const target =
      (id ? controls.current.get(id) : null) ??
      fallbackRef.current() ??
      (first ? controls.current.get(first) : null);
    target?.focus();
  }, []);

  return { register, willRemove, refocus };
}
