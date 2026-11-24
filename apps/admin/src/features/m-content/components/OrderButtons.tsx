'use client';
import { Icon, IconButton } from '@house/ui';
import { useEffect, useRef } from 'react';
import styles from './OrderButtons.module.css';

/** ▲▼ pair for keyboard-friendly reordering (no drag library in apps/admin). */
export function OrderButtons({
  name,
  index,
  count,
  onMove,
  disabled,
  direction = 'vertical',
}: {
  /** Item name for the accessible labels. */
  name: string;
  index: number;
  count: number;
  onMove: (delta: -1 | 1) => void;
  disabled?: boolean;
  direction?: 'vertical' | 'horizontal';
}) {
  const horizontal = direction === 'horizontal';
  const box = useRef<HTMLSpanElement>(null);
  const pending = useRef<-1 | 1 | null>(null);
  /**
   * React keeps the row's DOM nodes but may re-insert them to reorder the list, which blurs the
   * pressed button; and at the end of the list the pressed button becomes disabled. Once the move
   * has rendered (the index changed), put focus back on the pressed button — or on its partner —
   * instead of dropping it on <body>.
   */
  useEffect(() => {
    const delta = pending.current;
    if (delta === null) return;
    pending.current = null;
    const buttons = box.current?.querySelectorAll('button');
    const pressed = buttons?.[delta < 0 ? 0 : 1];
    const other = buttons?.[delta < 0 ? 1 : 0];
    const target = pressed && !pressed.disabled ? pressed : other && !other.disabled ? other : null;
    if (target && document.activeElement !== target) target.focus();
  }, [index]);
  const move = (delta: -1 | 1) => {
    pending.current = delta;
    onMove(delta);
  };
  return (
    <span ref={box} className={horizontal ? styles.h : styles.v}>
      <IconButton
        label={`${name} ${horizontal ? '앞으로' : '위로'} 이동`}
        size={32}
        variant="plain"
        disabled={disabled || index === 0}
        onClick={() => move(-1)}
      >
        <Icon name={horizontal ? 'chevron-left' : 'chevron-up'} size={18} />
      </IconButton>
      <IconButton
        label={`${name} ${horizontal ? '뒤로' : '아래로'} 이동`}
        size={32}
        variant="plain"
        disabled={disabled || index === count - 1}
        onClick={() => move(1)}
      >
        <Icon name={horizontal ? 'chevron-right' : 'chevron-down'} size={18} />
      </IconButton>
    </span>
  );
}
