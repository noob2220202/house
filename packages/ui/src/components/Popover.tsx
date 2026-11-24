'use client';
import { useId, useRef, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import styles from './Popover.module.css';
import { cx } from '../lib/cx';
import {
  useAnchoredPosition,
  useControllable,
  useDismiss,
  useFocusTrap,
  useMounted,
  type Placement,
} from '../lib/hooks';

export interface PopoverTriggerProps {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'dialog';
  'aria-controls': string | undefined;
}

export interface PopoverProps {
  /** Render the trigger; spread the given props on a <button>. */
  trigger: (props: PopoverTriggerProps) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  /** Accessible name of the panel. */
  label?: string;
  /** Panel width in px (default: content width, min 220). */
  width?: number;
  /** Remove default 16px padding. */
  flush?: boolean;
  className?: string;
}

/** Click-triggered floating panel (portal, fixed position, Esc/outside-click to close, focus returns to trigger). */
export function Popover({
  trigger,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  placement = 'bottom-start',
  label,
  width,
  flush,
  className,
}: PopoverProps) {
  const [isOpen, setOpen] = useControllable(open, defaultOpen, onOpenChange);
  const anchorRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const mounted = useMounted();
  const pos = useAnchoredPosition(isOpen, anchorRef, panelRef, placement);
  const close = () => setOpen(false);
  useDismiss(isOpen, close, [anchorRef, panelRef]);
  useFocusTrap(isOpen && pos.ready, panelRef);

  return (
    <>
      {trigger({
        ref: anchorRef,
        onClick: () => setOpen(!isOpen),
        'aria-expanded': isOpen,
        'aria-haspopup': 'dialog',
        'aria-controls': isOpen ? id : undefined,
      })}
      {mounted && isOpen
        ? createPortal(
            <div
              ref={panelRef}
              id={id}
              role="dialog"
              aria-label={label}
              tabIndex={-1}
              className={cx(styles.panel, flush && styles.flush, className)}
              style={{
                top: pos.top,
                left: pos.left,
                width,
                visibility: pos.ready ? 'visible' : 'hidden',
              }}
            >
              {typeof children === 'function' ? children(close) : children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
