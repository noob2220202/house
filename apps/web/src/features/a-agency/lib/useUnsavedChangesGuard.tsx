'use client';
import { ConfirmDialog } from '@house/ui';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

/** Same-origin, same-tab navigation target of a click, or null when the click is not one. */
export function guardedHref(event: MouseEvent, location: Location): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const target = event.target instanceof Element ? event.target : null;
  const anchor = target?.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if ((anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return null;
  const url = new URL(anchor.href, location.href);
  if (url.origin !== location.origin) return null;
  // In-page anchors (same path + query) do not leave the form.
  if (url.pathname === location.pathname && url.search === location.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Warns before unsaved edits are lost. While `dirty`:
 * - reload / tab close → the browser's own `beforeunload` prompt;
 * - any same-origin link click (sidebar, tab bar, header, in-page links) → a ConfirmDialog
 *   ("나가기" / "계속 편집"); the click is intercepted in the capture phase, before Next's <Link>.
 *
 * Browser Back/Forward is not intercepted: the App Router owns the history entries and offers no
 * blocking API, and a fake history entry would break Back for every other page.
 *
 * Render the returned element once (it is the dialog).
 */
export function useUnsavedChangesGuard(
  dirty: boolean,
  copy: { title?: string; description?: string } = {},
): ReactNode {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      const href = guardedHref(e, window.location);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingHref(href);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [dirty]);

  return (
    <ConfirmDialog
      open={pendingHref !== null}
      onClose={() => setPendingHref(null)}
      onConfirm={() => {
        const href = pendingHref;
        setPendingHref(null);
        if (href) router.push(href);
      }}
      title={copy.title ?? '저장하지 않은 변경사항이 있어요'}
      description={copy.description ?? '이 페이지를 나가면 바꾼 내용이 사라져요. 그래도 나갈까요?'}
      confirmLabel="나가기"
      cancelLabel="계속 편집"
      danger
    />
  );
}
