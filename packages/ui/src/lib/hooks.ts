'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export const useIsomorphicLayoutEffect =
  typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Controlled/uncontrolled state helper. */
export function useControllable<T>(
  value: T | undefined,
  defaultValue: T,
  onChange?: (next: T) => void,
): [T, (next: T) => void] {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = useCallback(
    (next: T) => {
      if (!controlled) setInner(next);
      onChange?.(next);
    },
    [controlled, onChange],
  );
  return [current, set];
}

/** Calls `onDismiss` on Escape or on pointer-down outside all given refs while `active`. */
export function useDismiss(
  active: boolean,
  onDismiss: () => void,
  refs: RefObject<HTMLElement | null>[],
): void {
  const cb = useRef(onDismiss);
  cb.current = onDismiss;
  const refsRef = useRef(refs);
  refsRef.current = refs;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        cb.current();
      }
    };
    const onDown = (e: PointerEvent | MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (refsRef.current.some((r) => r.current?.contains(target))) return;
      cb.current();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [active]);
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Traps Tab focus inside `ref` while active, focuses the first focusable element, restores focus on close. */
export function useFocusTrap(active: boolean, ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const node = ref.current;
    if (!active || !node) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE));
    const initial = node.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0] ?? node;
    initial.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    node.addEventListener('keydown', onKey);
    return () => {
      node.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [active, ref]);
}

let scrollLocks = 0;
/** Locks body scroll while active (ref-counted so nested overlays work). */
export function useScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    scrollLocks += 1;
    const { body } = document;
    const prev = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      scrollLocks -= 1;
      if (scrollLocks === 0) body.style.overflow = prev;
    };
  }, [active]);
}

/** True after mount — use to gate portals so SSR and first client render match. */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export type Placement = 'bottom-start' | 'bottom-end' | 'bottom' | 'top-start' | 'top-end' | 'top';

/** Fixed-position coordinates for a floating panel anchored to `anchor` (flips/clamps to the viewport). */
export function useAnchoredPosition(
  open: boolean,
  anchor: RefObject<HTMLElement | null>,
  floating: RefObject<HTMLElement | null>,
  placement: Placement = 'bottom-start',
  offset = 8,
): { top: number; left: number; ready: boolean } {
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false });
  useIsomorphicLayoutEffect(() => {
    if (!open) {
      setPos((p) => (p.ready ? { ...p, ready: false } : p));
      return;
    }
    const update = () => {
      const a = anchor.current?.getBoundingClientRect();
      const f = floating.current?.getBoundingClientRect();
      if (!a || !f) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const wantTop = placement.startsWith('top');
      const fitsBelow = a.bottom + offset + f.height <= vh - 8;
      const fitsAbove = a.top - offset - f.height >= 8;
      const above = wantTop ? fitsAbove || !fitsBelow : !fitsBelow && fitsAbove;
      let top = above ? a.top - offset - f.height : a.bottom + offset;
      let left = placement.endsWith('end')
        ? a.right - f.width
        : placement.endsWith('start')
          ? a.left
          : a.left + a.width / 2 - f.width / 2;
      left = Math.max(8, Math.min(left, vw - f.width - 8));
      top = Math.max(8, Math.min(top, vh - f.height - 8));
      setPos({ top, left, ready: true });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, placement, offset, anchor, floating]);
  return pos;
}

/**
 * `value`, once it has stopped changing for `ms` milliseconds (trailing debounce).
 * Use for search-as-you-type queries, map bounds refetches, autosave triggers …
 */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
