'use client';
import { Spinner, cx } from '@house/ui';
import { useLinkStatus } from 'next/link';
import type { ReactNode } from 'react';
import styles from './LinkPending.module.css';

export interface LinkPendingProps {
  /** Shown while the link is idle (e.g. its chevron). */
  idle?: ReactNode;
  className?: string;
}

/**
 * Progress hint for a my-page nav link — render it INSIDE the <Link>. The /me pages are rendered
 * on the server with their data and have no route-level skeleton (it would flash on every visit),
 * so on a slow connection this spinner is what tells the user the tap was registered. It fades in
 * after a short delay and never shows on fast navigations.
 */
export function LinkPending({ idle = null, className }: LinkPendingProps) {
  const { pending } = useLinkStatus();
  if (!pending) return idle;
  return <Spinner size={14} className={cx(styles.pending, className)} />;
}
