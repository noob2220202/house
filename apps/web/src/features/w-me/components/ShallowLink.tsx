'use client';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';

type ShallowLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

function isPlainClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !e.defaultPrevented && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey
  );
}

/**
 * Link for state that lives in the query string of the CURRENT page (tabs, pagination).
 * It is a real `<a href>` (open in new tab, copy link, works before hydration), but a plain click
 * only swaps the URL with `history.pushState` — Next keeps `useSearchParams()` in sync — so the
 * view re-renders from its client cache without an RSC round trip or the route's loading skeleton.
 */
export function ShallowLink({ href, onClick, ...rest }: ShallowLinkProps) {
  return (
    <a
      href={href}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (!isPlainClick(e)) return;
        e.preventDefault();
        window.history.pushState(null, '', href);
      }}
    />
  );
}

/** Same, for pagination: the next page starts at the top like a normal navigation would. */
export function ShallowPageLink(props: ShallowLinkProps) {
  return (
    <ShallowLink
      {...props}
      onClick={(e) => {
        props.onClick?.(e);
        if (isPlainClick(e)) window.scrollTo({ top: 0 });
      }}
    />
  );
}
