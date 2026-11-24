'use client';
import { useId, type ReactNode } from 'react';
import styles from './Drawer.module.css';
import { cx } from '../lib/cx';
import { IconButton } from './IconButton';
import { Overlay } from './Overlay';
import { Icon } from '../icons/Icon';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  /** Sticky footer (actions). */
  footer?: ReactNode;
  /** `right` (default) / `left` side panel, or `bottom` sheet (mobile). */
  side?: 'right' | 'left' | 'bottom';
  /** Panel width for side drawers (default 400). */
  width?: number;
  closeOnScrim?: boolean;
  /** Dark (ink) surface — navigation drawers. */
  ink?: boolean;
  /** Remove the body padding (lists, navigation). */
  flush?: boolean;
  className?: string;
}

/** Side drawer / bottom sheet (modal). For the non-modal map list sheet use `SheetSurface`. */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  side = 'right',
  width = 400,
  closeOnScrim,
  ink,
  flush,
  className,
}: DrawerProps) {
  const id = useId();
  return (
    <Overlay
      open={open}
      onClose={onClose}
      align={side}
      closeOnScrim={closeOnScrim}
      labelledBy={`${id}-t`}
      className={cx(styles.drawer, styles[side], ink && styles.ink, className)}
    >
      <div
        className={styles.inner}
        style={side === 'bottom' ? undefined : { width: `min(${width}px, 100vw)` }}
      >
        {side === 'bottom' && <span className={styles.handle} aria-hidden="true" />}
        <div className={styles.hd}>
          <h2 id={`${id}-t`} className={styles.title}>
            {title}
          </h2>
          <IconButton label="닫기" variant="plain" size={36} onClick={onClose}>
            <Icon name="close" size={20} />
          </IconButton>
        </div>
        <div className={cx(styles.bd, flush && styles.flush)}>{children}</div>
        {footer && <div className={styles.ft}>{footer}</div>}
      </div>
    </Overlay>
  );
}

export interface SheetSurfaceProps {
  children: ReactNode;
  /** Header row content (title, count, sort…). */
  header?: ReactNode;
  /** Show the drag handle. */
  handle?: boolean;
  className?: string;
}

/** Non-modal bottom sheet surface (`.sheet`): rounded top, handle, header — used over the mobile map. */
export function SheetSurface({ children, header, handle = true, className }: SheetSurfaceProps) {
  return (
    <section className={cx(styles.sheet, className)}>
      {handle && <span className={styles.handle} aria-hidden="true" />}
      {header && <div className={styles.sheetHd}>{header}</div>}
      {children}
    </section>
  );
}

export interface CtaBarProps {
  children: ReactNode;
  className?: string;
}

/** Sticky bottom action bar for mobile detail pages (`.cta-bar`). */
export function CtaBar({ children, className }: CtaBarProps) {
  return <div className={cx(styles.ctaBar, className)}>{children}</div>;
}
