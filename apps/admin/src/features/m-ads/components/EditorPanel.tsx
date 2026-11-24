'use client';
import { Icon, IconButton, useFocusTrap, useMounted, useScrollLock } from '@house/ui';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useMediaQuery } from '../hooks/useMediaQuery';
import styles from './editor.module.css';

/** From this width up the editor is docked next to the list (design: 480px right column). */
export const DOCK_QUERY = '(min-width: 1181px)';

export interface EditorPanelProps {
  /** Small line above the title: "AD-03 · 메인 상단 대형". */
  eyebrow?: ReactNode;
  title: string;
  /** Status pill next to the title. */
  status?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
}

/**
 * Edit drawer. ≥ 1181px it is a docked, non-modal complementary panel on the right (the list stays
 * usable, exactly like the design); below it becomes a modal sheet (focus trap, scroll lock, scrim).
 * Esc closes both.
 */
export function EditorPanel({
  eyebrow,
  title,
  status,
  onClose,
  children,
  footer,
  closeLabel = '편집 닫기',
}: EditorPanelProps) {
  const id = useId();
  const mounted = useMounted();
  const docked = useMediaQuery(DOCK_QUERY);
  const modal = mounted && !docked;
  const sheetRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useScrollLock(modal);
  useFocusTrap(modal, sheetRef);

  // Opening the docked (non-modal) panel moves focus to its title, so keyboard users land in the
  // form instead of having to tab past the whole list. The panel renders only once mounted, hence
  // `mounted` in the deps: with `[docked]` alone the effect ran while the title did not exist yet.
  useEffect(() => {
    if (mounted && docked) titleRef.current?.focus({ preventScroll: true });
  }, [mounted, docked]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // Leave Esc to popovers / dialogs that are open on top of the panel.
      if (document.querySelector('[role="dialog"]:not([data-ads-editor]), [role="listbox"]'))
        return;
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const inner = (
    <>
      <div className={styles.hd}>
        <div className={styles.hdText}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <div className={styles.titleRow}>
            <h2 id={`${id}-t`} ref={titleRef} tabIndex={-1} className={styles.title}>
              {title}
            </h2>
            {status}
          </div>
        </div>
        <IconButton label={closeLabel} variant="plain" onClick={onClose}>
          <Icon name="close" size={20} />
        </IconButton>
      </div>
      {children}
      {footer}
    </>
  );

  if (!mounted) return null;
  if (docked)
    return (
      <aside className={styles.dock} aria-labelledby={`${id}-t`}>
        {inner}
      </aside>
    );
  return createPortal(
    <div className={styles.layer}>
      <div className={styles.scrim} aria-hidden="true" onClick={onClose} />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-t`}
        data-ads-editor=""
        tabIndex={-1}
        className={styles.sheet}
      >
        {inner}
      </div>
    </div>,
    document.body,
  );
}

/** Scrollable body + sticky footer wrappers so editors can put a <form> around both. */
export function EditorBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>;
}
export function EditorFooter({ children }: { children: ReactNode }) {
  return <div className={styles.ft}>{children}</div>;
}
