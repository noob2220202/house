'use client';
import { MEDIA } from '@house/ui';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Size } from './geo';

/** True at the design system's mobile breakpoint (≤ 720px). False on the server. */
export function useIsMobile(): boolean {
  const subscribe = useCallback((notify: () => void) => {
    const mql = window.matchMedia(MEDIA.mobile);
    mql.addEventListener('change', notify);
    return () => mql.removeEventListener('change', notify);
  }, []);
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MEDIA.mobile).matches,
    () => false,
  );
}

/**
 * Tracks an element's content box. Returns a callback ref, so it keeps working when the element
 * is swapped (mobile ↔ desktop layout, a popover that mounts later).
 */
export function useElementSize<T extends HTMLElement>(): [(node: T | null) => void, Size] {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    if (!node) return;
    const apply = () =>
      setSize((prev) =>
        prev.width === node.clientWidth && prev.height === node.clientHeight
          ? prev
          : { width: node.clientWidth, height: node.clientHeight },
      );
    apply();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(apply);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, size];
}

/** Calls `onReach` when the sentinel scrolls into view (infinite lists). */
export function useInfiniteSentinel(onReach: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement | null>(null);
  const callback = useRef(onReach);
  callback.current = onReach;
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) callback.current();
      },
      { rootMargin: '240px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}
