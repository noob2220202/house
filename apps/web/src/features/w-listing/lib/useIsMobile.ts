'use client';
import { MEDIA } from '@house/ui';
import { useSyncExternalStore } from 'react';

const query = () => window.matchMedia(MEDIA.mobile);

function subscribe(onChange: () => void) {
  const mq = query();
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}

/** True at the mobile breakpoint (≤ 720px). False during SSR / first paint. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => query().matches,
    () => false,
  );
}
