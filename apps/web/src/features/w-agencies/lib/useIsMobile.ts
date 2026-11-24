'use client';
import { BREAKPOINTS, MEDIA } from '@house/ui';
import { useCallback, useSyncExternalStore } from 'react';

/** Tablet range of the design system: wider than mobile, up to the 1080px breakpoint. */
export const TABLET_MEDIA = `(min-width: ${BREAKPOINTS.mobile + 1}px) and (max-width: ${BREAKPOINTS.tablet}px)`;

/** `matchMedia(query).matches`, kept in sync. False during SSR / first paint (CSS owns that frame). */
export function useMatchMedia(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** True at the design system's mobile breakpoint (≤ 720px). False during SSR / first paint. */
export function useIsMobile(): boolean {
  return useMatchMedia(MEDIA.mobile);
}

/** True between the mobile and the tablet breakpoint (721–1080px). */
export function useIsTablet(): boolean {
  return useMatchMedia(TABLET_MEDIA);
}
