'use client';
import { cloneElement, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';
import { useAnchoredPosition, useMounted, type Placement } from '../lib/hooks';

interface TooltipChildProps {
  'aria-describedby'?: string;
  onMouseEnter?: (e: never) => void;
  onMouseLeave?: (e: never) => void;
  onFocus?: (e: never) => void;
  onBlur?: (e: never) => void;
  ref?: unknown;
}

export interface TooltipProps {
  /** Tooltip text. */
  content: ReactNode;
  /** A single focusable element (button, link, icon button). */
  children: ReactElement<TooltipChildProps>;
  placement?: Placement;
}

/** Hover/focus tooltip (role="tooltip", described-by wiring). Never put essential info only in a tooltip. */
export function Tooltip({ content, children, placement = 'top' }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchorRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const mounted = useMounted();
  const pos = useAnchoredPosition(open, anchorRef, tipRef, placement, 6);
  const child = cloneElement(children, {
    ref: anchorRef,
    'aria-describedby': open ? id : undefined,
    onMouseEnter: () => setOpen(true),
    onMouseLeave: () => setOpen(false),
    onFocus: () => setOpen(true),
    onBlur: () => setOpen(false),
  });
  return (
    <>
      {child}
      {mounted && open
        ? createPortal(
            <div
              ref={tipRef}
              id={id}
              role="tooltip"
              className={styles.tip}
              style={{ top: pos.top, left: pos.left, visibility: pos.ready ? 'visible' : 'hidden' }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
