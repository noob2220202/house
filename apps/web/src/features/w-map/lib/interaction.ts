'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { LatLng, MapBounds, MapViewState } from '@/lib/map';
import { distanceM, type Size } from './geo';
import { useElementSize } from './hooks';

const onChrome = (target: EventTarget) =>
  target instanceof Element &&
  !!target.closest('button, a, input, [role="dialog"], [data-map-chrome]');

/**
 * True while the visitor drags or wheels the map. Overlays that the page places from the visible
 * bounds (selection popover, my-location dot) lag behind a moving map — both map implementations
 * report their bounds only after the move settles — so they hide for the duration instead of
 * drifting away from their marker. Spread `motionProps` on the element that wraps the MapView.
 */
export function useMapMotion(bounds: MapBounds | null) {
  const [moving, setMoving] = useState(false);
  const press = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);
  const settleSoon = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    // Fallback for moves that end where they started (the bounds never change).
    timer.current = window.setTimeout(() => setMoving(false), 700);
  }, []);
  useEffect(() => setMoving(false), [bounds]);
  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );
  const release = () => {
    press.current = null;
    if (moving) settleSoon();
  };
  const motionProps = {
    onPointerDownCapture: (e: ReactPointerEvent) => {
      press.current = onChrome(e.target) ? null : { x: e.clientX, y: e.clientY };
    },
    onPointerMoveCapture: (e: ReactPointerEvent) => {
      const start = press.current;
      if (!start || moving) return;
      if (Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y) > 4) setMoving(true);
    },
    onPointerUpCapture: release,
    onPointerCancelCapture: release,
    onWheelCapture: (e: { target: EventTarget }) => {
      if (onChrome(e.target)) return;
      setMoving(true);
      settleSoon();
    },
  };
  return { moving, motionProps };
}

/**
 * Keyboard behaviour of the selection popover (a non-modal dialog on the map):
 * - the action that selects calls `rememberOpener()`; the popover takes focus when it appears, so
 *   it is one step away instead of a dozen Tab stops;
 * - Escape (when nothing else that owns Escape is open) and the popover's own close button call
 *   `closeSelection()`, which clears the selection and hands focus back to the marker / list row.
 */
export function useSelectionPopover({
  selected,
  select,
  enabled,
}: {
  selected: string | null;
  select: (id: string | null) => void;
  /** False on mobile: there the selection opens in the bottom sheet, not in a popover. */
  enabled: boolean;
}): {
  popRef: (node: HTMLElement | null) => void;
  popSize: Size;
  rememberOpener: () => void;
  closeSelection: () => void;
} {
  const [sizeRef, popSize] = useElementSize<HTMLElement>();
  const [node, setNode] = useState<HTMLElement | null>(null);
  const popRef = useCallback(
    (el: HTMLElement | null) => {
      setNode(el);
      sizeRef(el);
    },
    [sizeRef],
  );
  const wantFocus = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const rememberOpener = () => {
    const active = document.activeElement;
    opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
    wantFocus.current = enabled;
  };
  useEffect(() => {
    if (!wantFocus.current || !node) return;
    wantFocus.current = false;
    node.focus({ preventScroll: true });
  }, [node, selected]);

  const closeSelection = useCallback(() => {
    const el = opener.current;
    opener.current = null;
    select(null);
    if (el?.isConnected) el.focus({ preventScroll: true });
  }, [select]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const target = e.target instanceof Element ? e.target : null;
      // Escape belongs to whatever else is open first: a text field, a menu, another dialog.
      if (target?.closest('input, textarea, select, [role="listbox"]')) return;
      if (document.querySelector('[role="dialog"]:not([data-map-pop]), [aria-modal="true"]'))
        return;
      closeSelection();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected, closeSelection]);

  return { popRef, popSize, rememberOpener, closeSelection };
}

/**
 * The search field keeps the name of a picked suggestion only while the map still shows that
 * place. `track` records where a pick moved the map; once the map has arrived there and later
 * leaves (panned or zoomed away, selection closed, browser Back) `resetSignal` is bumped, which
 * empties the field.
 */
export function useSearchPick({
  view,
  selected,
  radiusM,
  minZoom,
}: {
  view: MapViewState;
  selected: string | null;
  /** A picked region is "on screen" while the map centre is within this distance of it … */
  radiusM: number;
  /** … and the zoom is at least this. */
  minZoom: number;
}): { resetSignal: number; track: (center: LatLng, selectedId: string | null) => void } {
  const [resetSignal, setResetSignal] = useState(0);
  const pick = useRef<{ center: LatLng; id: string | null; arrived: boolean } | null>(null);
  useEffect(() => {
    const p = pick.current;
    if (!p) return;
    const there = p.id
      ? selected === p.id
      : view.zoom >= minZoom && distanceM(view.center, p.center) < radiusM;
    if (there) p.arrived = true;
    else if (p.arrived) {
      pick.current = null;
      setResetSignal((n) => n + 1);
    }
  }, [view, selected, radiusM, minZoom]);
  const track = useCallback((center: LatLng, selectedId: string | null) => {
    pick.current = { center, id: selectedId, arrived: false };
  }, []);
  return { resetSignal, track };
}
