'use client';
import { cx } from '@house/ui';
import { useRef, type PointerEvent, type ReactNode } from 'react';
import s from './mobile.module.css';

export type SheetStop = 'peek' | 'half' | 'full';
const ORDER: readonly SheetStop[] = ['peek', 'half', 'full'];
const LABEL: Record<SheetStop, string> = { peek: '접힘', half: '절반', full: '전체' };

/** Next stop for a swipe: up → taller, down → shorter. */
export function nextStop(stop: SheetStop, direction: 'up' | 'down'): SheetStop {
  const i = ORDER.indexOf(stop) + (direction === 'up' ? 1 : -1);
  return ORDER[Math.max(0, Math.min(ORDER.length - 1, i))] ?? stop;
}

export interface MobileSheetProps {
  stop: SheetStop;
  onStopChange: (stop: SheetStop) => void;
  label: string;
  children: ReactNode;
}

/**
 * Non-modal bottom sheet over the map (MobileMap design): three stops (peek / half / full).
 * The handle is a real button (tap or Enter cycles the stops) and can be dragged; the sheet
 * follows the finger and snaps to the next stop on release.
 */
export function MobileSheet({ stop, onStopChange, label, children }: MobileSheetProps) {
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ y: number; height: number; moved: boolean } | null>(null);
  // A drag ends with a click event on the handle — swallow that one.
  const dragged = useRef(false);

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    const el = ref.current;
    if (!el) return;
    drag.current = { y: e.clientY, height: el.offsetHeight, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    el.style.transition = 'none';
    el.style.height = `${Math.max(96, d.height - dy)}px`;
  };
  const onPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el) return;
    el.style.transition = '';
    el.style.height = '';
    if (!d.moved) return; // a tap — handled by onClick
    dragged.current = true;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) > 36) onStopChange(nextStop(stop, dy < 0 ? 'up' : 'down'));
  };

  return (
    <section ref={ref} className={cx(s.sheet, s[stop])} aria-label={label} data-stop={stop}>
      <button
        type="button"
        className={s.handle}
        aria-label={`목록 높이 조절 (현재 ${LABEL[stop]})`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          // Taps cycle peek → half → full → half.
          onStopChange(stop === 'peek' ? 'half' : stop === 'half' ? 'full' : 'half');
        }}
      >
        <span aria-hidden="true" />
      </button>
      <div className={s.sheetBody}>{children}</div>
    </section>
  );
}
