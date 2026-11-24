'use client';
import { useEffect } from 'react';

export const UNSAVED_LEAVE_MESSAGE = '저장하지 않은 변경 사항이 있어요. 이 화면을 떠날까요?';

/** How many mounted forms are dirty right now (one set of listeners for all of them). */
let dirtyForms = 0;

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
}

/**
 * In-app navigation (sidebar, tabs, back links, breadcrumbs) is a client-side `<Link>` click, which
 * `beforeunload` never sees. Intercept same-origin link clicks in the capture phase — before Next's
 * router handles them — and ask first.
 */
function onLinkClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
    return;
  const target = e.target instanceof Element ? e.target : null;
  const anchor = target?.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return;
  const next = new URL(anchor.href, window.location.href);
  if (next.origin !== window.location.origin) return; // a full page load: beforeunload asks
  if (next.pathname === window.location.pathname && next.search === window.location.search) return; // same screen (hash link)
  if (!window.confirm(UNSAVED_LEAVE_MESSAGE)) {
    e.preventDefault();
    e.stopPropagation();
  }
}

/**
 * Asks before leaving a screen that has unsaved changes: closing / reloading the tab (browser
 * dialog) and following an in-app link (confirm). The browser back button is not covered.
 */
export function useUnsavedGuard(dirty: boolean): void {
  useEffect(() => {
    if (!dirty) return;
    dirtyForms += 1;
    if (dirtyForms === 1) {
      window.addEventListener('beforeunload', onBeforeUnload);
      document.addEventListener('click', onLinkClick, true);
    }
    return () => {
      dirtyForms -= 1;
      if (dirtyForms === 0) {
        window.removeEventListener('beforeunload', onBeforeUnload);
        document.removeEventListener('click', onLinkClick, true);
      }
    };
  }, [dirty]);
}
