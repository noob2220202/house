'use client';
import { useToast } from '@house/ui';
import { useCallback, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { errorMessage } from '@/lib/api';
import type { FavoriteToggle } from '../api';

/**
 * How long the "실행 취소" toast stays. The shared Toast neither pauses on hover/focus nor sits near
 * the removed card, so the toast is only the quick path — the inline <RemovedNotice> stays until
 * the user leaves the page (WCAG 2.2.1 Timing Adjustable).
 */
export const UNDO_TOAST_MS = 8000;
/** Removals kept in the inline notice (newest first). */
const MAX_NOTICES = 3;

export interface RemovedFavorite {
  id: string;
  /** Display name: "신대 레이크파크 1단지 103동". */
  name: string;
  /** The way back is being taken (PUT in flight). */
  restoring?: boolean;
}

const withItem = (list: RemovedFavorite[], item: RemovedFavorite) =>
  [item, ...list.filter((x) => x.id !== item.id)].slice(0, MAX_NOTICES);

/**
 * Remove-with-undo for a favourites list.
 *
 * `mutateAsync` is awaited per call, so every removal gets its own toast and its own undo even when
 * several hearts are clicked in a row (callbacks passed to `mutate()` only run for the latest call).
 * `removed` feeds the persistent inline notice; it is filled at once (optimistically) and cleared
 * again if the request fails.
 *
 * @param objectPhrase noun with its object particle: "매물을" / "단지를".
 * @param onNoticeGone called right after a notice row left the DOM (restored or dismissed) — the
 *   list uses it to put keyboard focus somewhere sensible, since the row's own button is gone.
 */
export function useFavoriteRemoval(
  mutateAsync: (vars: FavoriteToggle) => Promise<unknown>,
  objectPhrase: string,
  onNoticeGone?: (item: RemovedFavorite, restored: boolean) => void,
) {
  const { toast, dismiss } = useToast();
  const [removed, setRemoved] = useState<RemovedFavorite[]>([]);
  const toasts = useRef(new Map<string, number>());
  const restoring = useRef(new Set<string>());
  const gone = useRef(onNoticeGone);
  gone.current = onNoticeGone;

  const drop = useCallback((item: RemovedFavorite, restored: boolean) => {
    flushSync(() => setRemoved((list) => list.filter((x) => x.id !== item.id)));
    gone.current?.(item, restored);
  }, []);

  const restore = useCallback(
    async (item: RemovedFavorite) => {
      if (restoring.current.has(item.id)) return;
      restoring.current.add(item.id);
      setRemoved((list) => list.map((x) => (x.id === item.id ? { ...x, restoring: true } : x)));
      const toastId = toasts.current.get(item.id);
      if (toastId !== undefined) dismiss(toastId);
      toasts.current.delete(item.id);
      try {
        // Resolves once the list has been refetched, i.e. the card is back on screen.
        await mutateAsync({ id: item.id, favorite: true });
      } catch (e) {
        // Keep the way back open: the notice stays (or returns) so the user can retry.
        setRemoved((list) => withItem(list, { id: item.id, name: item.name }));
        toast({ message: errorMessage(e), tone: 'error' });
        return;
      } finally {
        restoring.current.delete(item.id);
      }
      drop(item, true);
      toast(`${item.name} ${objectPhrase} 다시 담았어요.`);
    },
    [dismiss, drop, mutateAsync, objectPhrase, toast],
  );

  const remove = useCallback(
    async (item: RemovedFavorite) => {
      setRemoved((list) => withItem(list, { id: item.id, name: item.name }));
      try {
        await mutateAsync({ id: item.id, favorite: false });
      } catch (e) {
        setRemoved((list) => list.filter((x) => x.id !== item.id));
        toast({ message: errorMessage(e), tone: 'error' });
        return;
      }
      toasts.current.set(
        item.id,
        toast({
          message: `${item.name} ${objectPhrase} 관심 목록에서 뺐어요.`,
          duration: UNDO_TOAST_MS,
          action: { label: '실행 취소', onClick: () => void restore(item) },
        }),
      );
    },
    [mutateAsync, objectPhrase, restore, toast],
  );

  const dismissRemoved = useCallback((item: RemovedFavorite) => drop(item, false), [drop]);

  return { remove, restore, removed, dismissRemoved };
}
