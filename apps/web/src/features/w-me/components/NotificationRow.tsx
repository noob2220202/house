'use client';
import { Icon, cx } from '@house/ui';
import Link from 'next/link';
import { useLayoutEffect, useRef, type Ref } from 'react';
import { formatRelativeTime } from '@/lib/format';
import { isUnread, notificationHref, notificationMeta } from '../lib/notifications';
import type { Notification } from '../schemas';
import styles from './NotificationRow.module.css';

export interface NotificationRowProps {
  notification: Notification;
  /** Called when the user opens / acknowledges an unread notification. */
  onRead?: (id: string) => void;
  /** One-line variant without the body text (overview panel). */
  compact?: boolean;
  /** Injected clock for stable relative times. */
  now?: Date;
  /** Ref of the row's interactive element (lists that drop read rows move focus to a neighbour). */
  rowRef?: Ref<HTMLElement>;
}

/**
 * One notification. A row with a destination is a link (opening it marks it read); an unread row
 * without one is a button that marks it read; a read row without one is plain text.
 *
 * Destination and caption come from the row itself (`notificationHref` / `notificationMeta`), which
 * tell agency events from personal ones — the same feed is shown on /me and in the broker console.
 */
export function NotificationRow({
  notification: n,
  onRead,
  compact,
  now,
  rowRef,
}: NotificationRowProps) {
  const meta = notificationMeta(n.type, n.data);
  const href = notificationHref(n);
  const unread = isUnread(n);
  const markRead = () => {
    if (unread) onRead?.(n.id);
  };

  // Acknowledging a row without a destination swaps its <button> for plain text. Keep the keyboard
  // position on the row instead of letting focus fall back to <body>.
  const textRef = useRef<HTMLDivElement>(null);
  const keepFocus = useRef(false);
  useLayoutEffect(() => {
    if (unread || !keepFocus.current) return;
    keepFocus.current = false;
    textRef.current?.focus();
  }, [unread]);

  const content = (
    <>
      <span className={cx(styles.icon, styles[meta.tone])}>
        <Icon name={meta.icon} size={compact ? 18 : 20} />
      </span>
      <span className={styles.main}>
        <span className={styles.cat}>
          {unread && <span className="sr-only">읽지 않음, </span>}
          <span className={styles.catLabel}>{meta.label}</span>
          <time dateTime={n.createdAt}>{formatRelativeTime(n.createdAt, now)}</time>
        </span>
        <span className={styles.title}>{n.title}</span>
        {!compact && n.body && <span className={styles.body}>{n.body}</span>}
      </span>
      {unread && <span className={styles.dot} aria-hidden="true" />}
      {href && !unread && <Icon name="chevron-right" size={18} className={styles.chev} />}
    </>
  );

  const className = cx(styles.row, unread && styles.unread, compact && styles.compact);
  if (href)
    return (
      <Link
        ref={rowRef as Ref<HTMLAnchorElement>}
        href={href}
        className={className}
        onClick={markRead}
      >
        {content}
      </Link>
    );
  if (unread && onRead)
    return (
      <button
        ref={rowRef as Ref<HTMLButtonElement>}
        type="button"
        className={className}
        onClick={(e) => {
          keepFocus.current = document.activeElement === e.currentTarget;
          markRead();
        }}
      >
        {content}
      </button>
    );
  return (
    <div ref={textRef} tabIndex={-1} className={className}>
      {content}
    </div>
  );
}
