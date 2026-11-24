'use client';
import Link from 'next/link';
import type { MouseEvent, ReactNode } from 'react';

/** The parts of the Navigation API used here (Chromium); other browsers simply follow the link. */
interface NavigationLike {
  currentEntry: { index: number } | null;
  entries(): { url: string | null }[];
}

const MAP_PREFIX = '/map/';

/** True when the previous entry of this tab's history is one of this site's map pages. */
export function previousEntryIsMap(): boolean {
  const nav = (window as Window & { navigation?: NavigationLike }).navigation;
  const index = nav?.currentEntry?.index;
  if (!nav || index === undefined || index < 1) return false;
  const url = nav.entries()[index - 1]?.url;
  if (!url) return false;
  try {
    const prev = new URL(url);
    return prev.origin === window.location.origin && prev.pathname.startsWith(MAP_PREFIX);
  } catch {
    return false;
  }
}

export interface BackToMapLinkProps {
  /** Fallback target: the map centred on this listing. */
  href: string;
  className?: string;
  children?: ReactNode;
  'aria-label'?: string;
}

/**
 * "지도로 돌아가기": when the visitor came from the map in this tab, goes back in history so the map
 * reopens exactly as it was (position, zoom and filters live in its URL). Otherwise it is a plain
 * link to the map centred on the listing. Modified clicks (new tab / window) are left alone.
 */
export function BackToMapLink({ href, className, children, ...rest }: BackToMapLinkProps) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    if (previousEntryIsMap()) {
      e.preventDefault();
      window.history.back();
    }
  };
  return (
    <Link href={href} className={className} aria-label={rest['aria-label']} onClick={onClick}>
      {children}
    </Link>
  );
}
