'use client';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { moveItem, sameOrder, stepTarget } from '../lib/reorder';

export interface RowDragOptions<T> {
  rows: readonly T[];
  idOf: (row: T) => string;
  /** Rows only move inside their group (banners: the slot). */
  groupOf: (row: T) => string;
  disabled?: boolean;
  /** Called once per finished move with the new id order of the moved row's group (visible rows only). */
  onCommit: (change: { group: string; ids: string[]; movedId: string; index: number }) => void;
}

interface DragState {
  id: string;
  /** Pointer offset from the top of the row at grab time. */
  grab: number;
  lastY: number;
  /** translateY currently applied to the row. */
  applied: number;
}

/**
 * Sortable rows without a drag-and-drop library (dnd-kit is not installed in this workspace):
 * pointer drag on a handle with live swapping + a follow-the-pointer transform, and keyboard moves
 * (↑ / ↓ on the focused handle). Works for <tr> rows and for the stacked mobile cards.
 */
export function useRowDrag<T>({ rows, idOf, groupOf, disabled, onCommit }: RowDragOptions<T>) {
  const [draft, setDraft] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const rowEls = useRef(new Map<string, HTMLElement>());
  const handleEls = useRef(new Map<string, HTMLElement>());
  const drag = useRef<DragState | null>(null);
  const draftRef = useRef<string[] | null>(null);
  const focusAfter = useRef<string | null>(null);
  const latest = useRef({ rows, idOf, groupOf, onCommit });
  latest.current = { rows, idOf, groupOf, onCommit };

  const byId = useMemo(() => new Map(rows.map((row) => [idOf(row), row])), [rows, idOf]);
  const ordered = useMemo<readonly T[]>(() => {
    if (!draft) return rows;
    const list = draft.map((id) => byId.get(id)).filter((row): row is T => row !== undefined);
    return list.length === rows.length ? list : rows;
  }, [draft, rows, byId]);

  const setOrder = useCallback((next: string[] | null) => {
    draftRef.current = next;
    setDraft(next);
  }, []);

  /** Moves the dragged row with the pointer and swaps it with a neighbour once it passes its middle. */
  const step = useCallback(() => {
    const state = drag.current;
    const order = draftRef.current;
    if (!state || !order) return;
    const el = rowEls.current.get(state.id);
    if (!el) return;
    const { rows: all, idOf: getId, groupOf: getGroup } = latest.current;
    const groupById = new Map(all.map((row) => [getId(row), getGroup(row)]));
    const rect = el.getBoundingClientRect();
    const natural = rect.top - state.applied;
    let dy = state.lastY - state.grab - natural;
    const index = order.indexOf(state.id);
    const group = groupById.get(state.id);
    const neighbour = (offset: -1 | 1) => {
      const id = order[index + offset];
      return id !== undefined && groupById.get(id) === group ? rowEls.current.get(id) : undefined;
    };
    const prev = neighbour(-1);
    const next = neighbour(1);
    const center = natural + dy + rect.height / 2;
    if (prev) {
      const r = prev.getBoundingClientRect();
      if (center < r.top + r.height / 2) {
        setOrder(moveItem(order, index, index - 1));
        return; // the layout effect re-runs `step` after the swap rendered
      }
    } else {
      dy = Math.max(dy, -6);
    }
    if (next) {
      const r = next.getBoundingClientRect();
      if (center > r.top + r.height / 2) {
        setOrder(moveItem(order, index, index + 1));
        return;
      }
    } else {
      dy = Math.min(dy, 6);
    }
    el.style.transform = `translateY(${dy}px)`;
    state.applied = dy;
  }, [setOrder]);

  useLayoutEffect(() => {
    if (drag.current) step();
  }, [draft, step]);

  const finish = useCallback(
    (commit: boolean) => {
      const state = drag.current;
      if (!state) return;
      drag.current = null;
      const el = rowEls.current.get(state.id);
      if (el) el.style.transform = '';
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      const order = draftRef.current;
      const { rows: all, idOf: getId, groupOf: getGroup, onCommit: commitFn } = latest.current;
      setDraggingId(null);
      setOrder(null);
      if (!commit || !order) return;
      const before = all.map(getId);
      if (sameOrder(before, order)) return;
      const moved = all.find((row) => getId(row) === state.id);
      if (!moved) return;
      const group = getGroup(moved);
      const groupIds = order.filter((id) => {
        const row = all.find((r) => getId(r) === id);
        return row !== undefined && getGroup(row) === group;
      });
      focusAfter.current = state.id;
      commitFn({ group, ids: groupIds, movedId: state.id, index: groupIds.indexOf(state.id) });
    },
    [setOrder],
  );

  // Window listeners: React may move the dragged row's DOM node while swapping, which would drop
  // pointer capture on the handle.
  useEffect(() => {
    if (!draggingId) return;
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return;
      drag.current.lastY = e.clientY;
      step();
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
    };
  }, [draggingId, step, finish]);

  // Keep keyboard focus on the handle of the row that was just moved.
  useEffect(() => {
    const id = focusAfter.current;
    if (!id) return;
    focusAfter.current = null;
    handleEls.current.get(id)?.focus();
  }, [rows]);

  useEffect(
    () => () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    },
    [],
  );

  const rowRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) rowEls.current.set(id, el);
      else rowEls.current.delete(id);
    },
    [],
  );

  const handleProps = useCallback(
    (id: string) => ({
      ref: (el: HTMLElement | null) => {
        if (el) handleEls.current.set(id, el);
        else handleEls.current.delete(id);
      },
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (disabled || e.button !== 0 || drag.current) return;
        const el = rowEls.current.get(id);
        if (!el) return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        drag.current = { id, grab: e.clientY - rect.top, lastY: e.clientY, applied: 0 };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
        setOrder(latest.current.rows.map(latest.current.idOf));
        setDraggingId(id);
      },
      onKeyDown: (e: ReactKeyboardEvent<HTMLElement>) => {
        if (disabled || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
        e.preventDefault();
        const { rows: all, idOf: getId, groupOf: getGroup, onCommit: commitFn } = latest.current;
        const index = all.findIndex((row) => getId(row) === id);
        const target = stepTarget(all, index, e.key === 'ArrowUp' ? -1 : 1, getGroup);
        const row = all[index];
        if (target < 0 || row === undefined) return;
        const group = getGroup(row);
        const groupIds = moveItem(all, index, target)
          .filter((r) => getGroup(r) === group)
          .map(getId);
        focusAfter.current = id;
        commitFn({ group, ids: groupIds, movedId: id, index: groupIds.indexOf(id) });
      },
    }),
    [disabled, setOrder],
  );

  return { ordered, draggingId, rowRef, handleProps };
}
