'use client';
import { useToast } from '@house/ui';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { z } from 'zod';
import { ROUTES } from '@/config/nav';
import { api, errorMessage } from '@/lib/api';
import { clearIntent, readIntent, useAuthGate } from '@/lib/auth/gate';
import { useSession } from '@/lib/auth/session';

/**
 * THE favourites module: 관심 매물 / 관심 단지 / 관심 중개사무소 hearts everywhere on the site read
 * and write the same id cache through these hooks, so a heart flipped on the map is filled on the
 * home page, the listing page and my page at once.
 *
 * - `GET /me/favorites/{kind}?pageSize=100` → the id set (`['favorites', kind, 'ids']`);
 * - `PUT` / `DELETE /me/favorites/{kind}/:id` with an optimistic id-set update and rollback;
 * - every settle invalidates `['favorites']` and the my-page lists (`['me-favorites']`).
 */

export type FavoriteKind = 'listings' | 'complexes' | 'agencies';

export const favoriteKeys = {
  all: ['favorites'] as const,
  ids: (kind: FavoriteKind) => ['favorites', kind, 'ids'] as const,
  toggle: (kind: FavoriteKind) => ['favorites', kind, 'toggle'] as const,
};
/** My-page list caches (w-me `meKeys.favorites`) refreshed after every toggle. */
const ME_FAVORITES_KEY = ['me-favorites'] as const;

const NOUN: Record<FavoriteKind, string> = {
  listings: '관심 매물',
  complexes: '관심 단지',
  agencies: '관심 중개사무소',
};
const LIST_HREF: Record<FavoriteKind, string> = {
  listings: ROUTES.favorites,
  complexes: `${ROUTES.favorites}?tab=complexes`,
  agencies: ROUTES.favorites,
};

/** Accessible name of a heart: "신대 레이크파크 1단지 관심 매물에 추가" / "…에서 빼기". */
export function favoriteLabel(kind: FavoriteKind, name: string, on: boolean): string {
  return `${name} ${NOUN[kind]}${on ? '에서 빼기' : '에 추가'}`;
}

/** Toast after a toggle. No particles after names: "연향 센트럴를" would be wrong. */
export function favoriteToast(kind: FavoriteKind, on: boolean) {
  return on
    ? {
        message: `${NOUN[kind]}에 담았어요.`,
        action: { label: '보러 가기', href: LIST_HREF[kind] },
      }
    : { message: `${NOUN[kind]}에서 뺐어요.`, tone: 'info' as const };
}

const ref = z.object({ id: z.string() });
/**
 * Ids of one favourites page. Listings and complexes arrive as `{ favoritedAt, listing | complex }`
 * (`FavoriteListingItem` / `FavoriteComplexItem`); agencies as flat `{ id, … }` rows.
 */
const idsSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.string().optional(),
          listing: ref.optional(),
          complex: ref.optional(),
        }),
      )
      .default([]),
  })
  .transform((v) =>
    v.items.flatMap((i) => {
      const id = i.id ?? i.listing?.id ?? i.complex?.id;
      return id ? [id] : [];
    }),
  );

const path = (kind: FavoriteKind, id: string) => `/me/favorites/${kind}/${encodeURIComponent(id)}`;

export interface FavoriteIds {
  /** Ids of the signed-in user's favourites (always empty while signed out). */
  ids: ReadonlySet<string>;
  has: (id: string) => boolean;
  /** True while the first fetch of a signed-in user is running. */
  isPending: boolean;
}

/** Id set of the user's favourites of one kind (one shared query for every heart on the page). */
export function useFavoriteIds(kind: FavoriteKind): FavoriteIds {
  const { status } = useSession();
  const authed = status === 'authenticated';
  const query = useQuery({
    queryKey: favoriteKeys.ids(kind),
    queryFn: ({ signal }) =>
      api.get(`/me/favorites/${kind}`, { query: { pageSize: 100 }, schema: idsSchema, signal }),
    enabled: authed,
    staleTime: 60_000,
    retry: false,
  });
  const ids = useMemo<ReadonlySet<string>>(
    () => new Set(authed ? (query.data ?? []) : []),
    [authed, query.data],
  );
  const has = useCallback((id: string) => ids.has(id), [ids]);
  return { ids, has, isPending: authed && query.isPending };
}

export interface FavoriteToggleVars {
  id: string;
  /** Desired state: true = PUT (add), false = DELETE (remove). */
  favorite: boolean;
}

/**
 * Extra optimistic work of a caller (e.g. my page removing the card from its cached pages). The
 * value returned by `onMutate` comes back to `onError` for a per-call rollback.
 */
export interface FavoriteToggleExtension<C> {
  onMutate?: (vars: FavoriteToggleVars, queryClient: QueryClient) => C | Promise<C>;
  onError?: (vars: FavoriteToggleVars, context: C | undefined, queryClient: QueryClient) => void;
}

interface ToggleContext<C> {
  previous: string[] | undefined;
  extra: C | undefined;
}

/**
 * PUT / DELETE `/me/favorites/{kind}/:id` with an optimistic id-set update and rollback on error.
 * Returns the TanStack mutation: use `mutateAsync` when every call needs its own result (toasts,
 * undo) — callbacks passed to `mutate()` only run for the latest call.
 *
 * While sibling toggles are still running only the last one to settle refetches, so a refetch never
 * resurrects a card another toggle just removed. Adding resolves once the lists show the item.
 */
export function useFavoriteToggle<C = undefined>(
  kind: FavoriteKind,
  extension?: FavoriteToggleExtension<C>,
): UseMutationResult<unknown, unknown, FavoriteToggleVars, ToggleContext<C>> {
  const queryClient = useQueryClient();
  const key = favoriteKeys.ids(kind);
  return useMutation<unknown, unknown, FavoriteToggleVars, ToggleContext<C>>({
    mutationKey: favoriteKeys.toggle(kind),
    mutationFn: ({ id, favorite }) =>
      favorite ? api.put(path(kind, id)) : api.delete(path(kind, id)),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<string[]>(key);
      queryClient.setQueryData<string[]>(key, (ids = []) =>
        vars.favorite
          ? [vars.id, ...ids.filter((x) => x !== vars.id)]
          : ids.filter((x) => x !== vars.id),
      );
      const extra = extension?.onMutate ? await extension.onMutate(vars, queryClient) : undefined;
      return { previous, extra };
    },
    onError: (_error, vars, context) => {
      // Only this id goes back: a whole-set snapshot would also undo a sibling toggle.
      queryClient.setQueryData<string[]>(key, (ids = []) =>
        vars.favorite
          ? ids.filter((x) => x !== vars.id)
          : [vars.id, ...ids.filter((x) => x !== vars.id)],
      );
      extension?.onError?.(vars, context?.extra, queryClient);
    },
    onSettled: (_data, _error, vars) => {
      // This mutation still counts as running here.
      if (queryClient.isMutating({ mutationKey: favoriteKeys.toggle(kind) }) > 1) return;
      const refresh = Promise.all([
        queryClient.invalidateQueries({ queryKey: favoriteKeys.all }),
        queryClient.invalidateQueries({ queryKey: ME_FAVORITES_KEY }),
      ]);
      return vars.favorite ? refresh : undefined;
    },
  });
}

export interface FavoriteActions {
  has: (id: string) => boolean;
  /** Auth-gated toggle with toasts; signed-out visitors log in and the heart is resumed. */
  toggle: (id: string) => void;
  /** Explicit state (PUT / DELETE), same gate and toasts. */
  set: (id: string, favorite: boolean) => void;
  label: (id: string, name: string) => string;
  pending: boolean;
  isPending: boolean;
}

/**
 * Hearts of a list (map cards, similar listings): one id set, one gate, one toast style.
 * Signed-out visitors are sent to /login and come back with `?intent=favorite&target=<kind>:<id>`;
 * the heart is then added automatically. `primaryId` also resumes a bare `?intent=favorite`
 * (the page's own listing / complex / office).
 */
export function useFavoriteActions(
  kind: FavoriteKind,
  options: { primaryId?: string } = {},
): FavoriteActions {
  const favorites = useFavoriteIds(kind);
  const { mutateAsync, isPending } = useFavoriteToggle(kind);
  const { gate, status } = useAuthGate();
  const { toast } = useToast();
  const live = useRef(favorites);
  live.current = favorites;

  const apply = useCallback(
    async (id: string, favorite: boolean) => {
      try {
        await mutateAsync({ id, favorite });
        toast(favoriteToast(kind, favorite));
      } catch (e) {
        toast({ message: errorMessage(e), tone: 'error' });
      }
    },
    [kind, mutateAsync, toast],
  );

  const set = useCallback(
    (id: string, favorite: boolean) =>
      gate(() => void apply(id, favorite), 'favorite', `${kind}:${id}`),
    [apply, gate, kind],
  );
  const toggle = useCallback(
    (id: string) => gate(() => void apply(id, !live.current.has(id)), 'favorite', `${kind}:${id}`),
    [apply, gate, kind],
  );

  // Resume a heart clicked before login. The first hook that matches strips the params, so the
  // other hearts on the page see a clean URL. PUT is idempotent — no need to wait for the ids.
  const { primaryId } = options;
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || status === 'loading') return;
    const intent = readIntent();
    if (intent?.intent !== 'favorite') return;
    const id = intent.target?.startsWith(`${kind}:`)
      ? intent.target.slice(kind.length + 1)
      : !intent.target
        ? primaryId
        : undefined;
    if (!id) return;
    resumed.current = true;
    clearIntent();
    if (status === 'authenticated') void apply(id, true);
  }, [apply, kind, primaryId, status]);

  return {
    has: favorites.has,
    toggle,
    set,
    label: (id, name) => favoriteLabel(kind, name, favorites.has(id)),
    pending: isPending,
    isPending: favorites.isPending,
  };
}

export interface FavoriteState {
  on: boolean;
  toggle: () => void;
  /** Accessible name of the heart. */
  label: string;
  pending: boolean;
}

/** One heart: `const fav = useFavorite('complexes', complex.id, complex.name)`. */
export function useFavorite(
  kind: FavoriteKind,
  id: string,
  name: string,
  options: { primary?: boolean } = {},
): FavoriteState {
  const actions = useFavoriteActions(kind, options.primary ? { primaryId: id } : {});
  const on = actions.has(id);
  const { toggle } = actions;
  return {
    on,
    toggle: useCallback(() => toggle(id), [id, toggle]),
    label: favoriteLabel(kind, name, on),
    pending: actions.pending,
  };
}
