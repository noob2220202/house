'use client';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { env } from '@/config/env';
import { fetchPopups, homeKeys } from '../../api/client';
import type { Popup } from '../../api/schemas';
import {
  hidePopupForDays,
  hidePopupForSession,
  isPopupHidden,
  popupPageForPath,
  popupStorageKey,
  prunePopupStore,
  type StorageLike,
} from '../../lib/popup';

// The dialog (image, focus trap, portal) is only downloaded when there is a popup to show.
const NoticePopup = dynamic(() => import('./NoticePopup').then((m) => m.NoticePopup), {
  ssr: false,
});

function storage(kind: 'local' | 'session'): StorageLike | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // storage blocked (privacy mode / cookies disabled)
  }
}

/** `?popup=off` keeps screenshots and visual tests clean — honoured outside production only. */
function suppressedByQuery(): boolean {
  if (env.isProd && !env.apiMock) return false;
  return new URLSearchParams(window.location.search).get('popup') === 'off';
}

/**
 * Admin-managed notice popup layer, mounted once in the root layout. For every navigation it asks
 * `GET /popups?page=<target of the current path>` and shows the live popups one at a time
 * (back-office order) unless the visitor hid them:
 * - "N일 동안 보지 않기" → localStorage, keyed by popup id + version (`updatedAt`), so an edited
 *   popup shows again;
 * - "닫기" → sessionStorage (stays closed for this tab session).
 * Nothing is rendered on the server — the stores are only readable after hydration.
 */
export function NoticePopupHost() {
  const pathname = usePathname();
  const page = popupPageForPath(pathname ?? '/');
  const [ready, setReady] = useState(false);
  const [closed, setClosed] = useState<readonly string[]>([]);

  useEffect(() => {
    setReady(!suppressedByQuery());
  }, [pathname]);

  const { data } = useQuery({
    queryKey: page ? homeKeys.popups(page) : ['popups', 'none'],
    queryFn: ({ signal }) => fetchPopups(page!, signal),
    enabled: ready && page !== null,
    staleTime: 5 * 60_000,
    retry: false,
  });

  const popups: readonly Popup[] = useMemo(() => data?.items ?? [], [data]);

  useEffect(() => {
    if (popups.length > 0) prunePopupStore(storage('local'), popups);
  }, [popups]);

  const visible = useMemo(() => {
    if (!ready || page === null) return [];
    const stores = { local: storage('local'), session: storage('session') };
    return popups.filter((p) => !closed.includes(popupStorageKey(p)) && !isPopupHidden(p, stores));
  }, [ready, page, popups, closed]);

  const current = visible[0];
  if (!current) return null;
  // Queue position among the popups of this page: the ones already closed here come first.
  const closedHere = popups.filter((p) => closed.includes(popupStorageKey(p))).length;
  const total = closedHere + visible.length;

  const close = (popup: Popup, days: number) => {
    if (days > 0) hidePopupForDays(popup, days, storage('local'));
    else hidePopupForSession(popup, storage('session'));
    setClosed((list) => [...list, popupStorageKey(popup)]);
  };

  return (
    <NoticePopup
      key={popupStorageKey(current)}
      popup={current}
      position={total > 1 ? { index: closedHere + 1, total } : undefined}
      onClose={() => close(current, 0)}
      onDismiss={() => close(current, current.dismissDays)}
    />
  );
}
