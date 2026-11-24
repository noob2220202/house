'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Overlay.module.css';
import { cx } from '../lib/cx';
import { useFocusTrap, useMounted, useScrollLock } from '../lib/hooks';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  /** Layout of the scrim container. */
  align: 'center' | 'right' | 'left' | 'bottom';
  /** Close when the scrim is clicked (default true). */
  closeOnScrim?: boolean;
  labelledBy?: string;
  describedBy?: string;
  label?: string;
  className?: string;
  children: ReactNode;
}

/** Internal modal layer: portal + scrim + focus trap + scroll lock + Esc. */
export function Overlay({
  open,
  onClose,
  align,
  closeOnScrim = true,
  labelledBy,
  describedBy,
  label,
  className,
  children,
}: OverlayProps) {
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);
  useScrollLock(open);
  useFocusTrap(open && mounted, ref);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  if (!mounted || !open) return null;
  return createPortal(
    <div className={cx(styles.layer, styles[align])}>
      <div
        className={styles.scrim}
        onClick={closeOnScrim ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={label}
        tabIndex={-1}
        className={className}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
