'use client';
import { useEffect, useState } from 'react';

/**
 * `[ref, overflowing]` — true while the element scrolls sideways (content wider than the box).
 * Used to make a horizontal card scroller keyboard-focusable only where it really scrolls (mobile),
 * not as a dead tab stop on layouts where the same list is a grid.
 */
export function useOverflowX<T extends HTMLElement>(): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') {
      setOverflowing(false);
      return;
    }
    const measure = () => setOverflowing(el.scrollWidth > el.clientWidth + 1);
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(el);
    // Cards arriving or leaving change scrollWidth without resizing the box itself.
    const mutations = new MutationObserver(measure);
    mutations.observe(el, { childList: true });
    return () => {
      resize.disconnect();
      mutations.disconnect();
    };
  }, [el]);
  return [setEl, overflowing];
}
