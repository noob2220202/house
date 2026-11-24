'use client';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useMounted } from '@house/ui';
import type { z } from 'zod';
import { api } from '@/lib/api';
import { useFavoriteToggle } from '@/lib/favorites/useFavorite';
import { FALLBACK_NICKNAME, SESSION_QUERY_KEY, type SessionUser } from '@/lib/auth';
import type { ProfilePatch } from './lib/profile';
import {
  FAVORITES_PAGE_SIZE,
  RECENT_PAGE_SIZE,
  meKeys,
  meQueries,
  type MeFetcher,
  type NotificationFilter,
  type NotificationScope,
} from './queries';
import {
  notificationReadResultSchema,
  profileSchema,
  type FavoriteComplex,
  type FavoriteComplexPage,
  type FavoriteListing,
  type FavoriteListingPage,
  type NotificationPage,
  type Profile,
  type RecentViewPage,
} from './schemas';

export {
  NOTIFICATION_PAGE_SIZE,
  meKeys,
  type NotificationFilter,
  type NotificationScope,
} from './queries';

/** Browser side of `MeFetcher`: same-origin fetch with the session cookie. */
const browserFetch: MeFetcher = <S extends z.ZodType>(
  path: string,
  options: Parameters<MeFetcher>[1] & { schema: S },
) => api.get(path, options) as Promise<z.infer<S>>;

// ---------- favorites ----------

export function useFavoriteListings(page = 1, pageSize = FAVORITES_PAGE_SIZE) {
  return useQuery({
    ...meQueries.favoriteListings(browserFetch, page, pageSize),
    placeholderData: (prev) => prev,
  });
}

export function useFavoriteComplexes(page = 1, pageSize = FAVORITES_PAGE_SIZE) {
  return useQuery({
    ...meQueries.favoriteComplexes(browserFetch, page, pageSize),
    placeholderData: (prev) => prev,
  });
}

export type { FavoriteToggleVars as FavoriteToggle } from '@/lib/favorites/useFavorite';

interface PageOf<T> {
  items: T[];
  total: number;
  totalPages: number;
  pageSize: number;
}

/** Drops one row from a cached page and keeps the counters consistent. */
export function removeFromPage<T extends { id: string }, P extends PageOf<T>>(
  page: P,
  id: string,
): P {
  const items = page.items.filter((item) => item.id !== id);
  if (items.length === page.items.length) return page;
  const total = Math.max(0, page.total - 1);
  return { ...page, items, total, totalPages: Math.max(1, Math.ceil(total / page.pageSize)) };
}

/** Puts a removed row back at its old position (rollback of one failed removal). */
export function insertIntoPage<T extends { id: string }, P extends PageOf<T>>(
  page: P,
  item: T,
  index: number,
): P {
  if (page.items.some((x) => x.id === item.id)) return page;
  const items = [...page.items];
  items.splice(Math.min(Math.max(0, index), items.length), 0, item);
  const total = page.total + 1;
  return { ...page, items, total, totalPages: Math.max(1, Math.ceil(total / page.pageSize)) };
}

interface RemovedRow<T> {
  queryKey: QueryKey;
  item: T;
  index: number;
}

/** Optimistic removal from every cached page; returns what was taken out, for a per-row rollback. */
function takeFromCachedPages<T extends { id: string }, P extends PageOf<T>>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  id: string,
): RemovedRow<T>[] {
  const removed: RemovedRow<T>[] = [];
  for (const [key, page] of queryClient.getQueriesData<P>({ queryKey })) {
    const index = page?.items.findIndex((item) => item.id === id) ?? -1;
    const item = page?.items[index];
    if (!page || !item) continue;
    removed.push({ queryKey: key, item, index });
    queryClient.setQueryData<P>(key, removeFromPage<T, P>(page, id));
  }
  return removed;
}

/**
 * Rollback of ONE removal: only its own row returns. A whole-cache snapshot would also bring back
 * rows that a sibling removal (still in flight, or already confirmed) took out.
 */
function putBackIntoCachedPages<T extends { id: string }, P extends PageOf<T>>(
  queryClient: QueryClient,
  removed: readonly RemovedRow<T>[] | undefined,
) {
  removed?.forEach(({ queryKey, item, index }) =>
    queryClient.setQueryData<P>(
      queryKey,
      (page) => page && insertIntoPage<T, P>(page, item, index),
    ),
  );
}

function setRecentFavoriteFlag(queryClient: QueryClient, id: string, favorite: boolean) {
  queryClient.setQueriesData<RecentViewPage>(
    { queryKey: meKeys.recentViews() },
    (old) =>
      old && {
        ...old,
        items: old.items.map((view) =>
          view.listing && view.listing.id === id
            ? { ...view, listing: { ...view.listing, isFavorite: favorite } }
            : view,
        ),
      },
  );
}

/**
 * Add / remove a 관심 매물 — the shared favourites mutation (`@/lib/favorites/useFavorite`: same
 * endpoints, id cache and invalidation as every heart on the site) plus my page's optimistic work:
 * removal takes the card out of every cached favourites page at once and flips the heart on cached
 * recent views; a failure puts back that one card only.
 *
 * Several removals may overlap (two hearts clicked in a row). Callers that need a per-call result
 * (toast, undo) must `await mutateAsync(...)` — TanStack runs the callbacks passed to `mutate()`
 * only for the LATEST call of a hook instance. Adding resolves once the lists show the card again.
 */
export function useToggleFavoriteListing() {
  return useFavoriteToggle<RemovedRow<FavoriteListing>[]>('listings', {
    onMutate: async ({ id, favorite }, queryClient) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: meKeys.favoriteListings() }),
        queryClient.cancelQueries({ queryKey: meKeys.recentViews() }),
      ]);
      setRecentFavoriteFlag(queryClient, id, favorite);
      return favorite
        ? []
        : takeFromCachedPages<FavoriteListing, FavoriteListingPage>(
            queryClient,
            meKeys.favoriteListings(),
            id,
          );
    },
    onError: ({ id, favorite }, removed, queryClient) => {
      putBackIntoCachedPages<FavoriteListing, FavoriteListingPage>(queryClient, removed);
      setRecentFavoriteFlag(queryClient, id, !favorite);
    },
  });
}

/** Add / remove a 관심 단지 (optimistic removal, per-card rollback; see useToggleFavoriteListing). */
export function useToggleFavoriteComplex() {
  return useFavoriteToggle<RemovedRow<FavoriteComplex>[]>('complexes', {
    onMutate: async ({ id, favorite }, queryClient) => {
      await queryClient.cancelQueries({ queryKey: meKeys.favoriteComplexes() });
      return favorite
        ? []
        : takeFromCachedPages<FavoriteComplex, FavoriteComplexPage>(
            queryClient,
            meKeys.favoriteComplexes(),
            id,
          );
    },
    onError: (_vars, removed, queryClient) =>
      putBackIntoCachedPages<FavoriteComplex, FavoriteComplexPage>(queryClient, removed),
  });
}

// ---------- recent views ----------

export function useRecentViews(page = 1, pageSize = RECENT_PAGE_SIZE) {
  return useQuery({
    ...meQueries.recentViews(browserFetch, page, pageSize),
    placeholderData: (prev) => prev,
  });
}

// ---------- notifications ----------

export function useNotificationFeed(filter: NotificationFilter, scope?: NotificationScope) {
  const queryClient = useQueryClient();
  return useInfiniteQuery(
    // Every feed response carries the unread count of its scope: keep the badges in step with it
    // instead of waiting for the separate counter request.
    meQueries.notificationFeed(
      browserFetch,
      filter,
      (page) => {
        if (page.unreadCount !== undefined)
          queryClient.setQueryData<number>(meKeys.notificationUnreadOf(scope), page.unreadCount);
      },
      scope,
    ),
  );
}

/** Unread counter for badges (sidebar, mobile header, overview tile, console bell). */
export function useUnreadNotificationCount(scope?: NotificationScope): {
  data: number | undefined;
  isError: boolean;
} {
  // Several components share this query. One that hydrates late (below a Suspense boundary) could
  // already find the answer in the cache and render differently from the server HTML, so the value
  // is only exposed after mount.
  //
  // The query also only starts after mount: the side navigation lives in the /me layout, above the
  // page's <HydrationBoundary>, so it creates this query before the page has hydrated the counter
  // the server already loaded (from the feed's `unreadCount` or its own prefetch). Fetching right
  // away would repeat that request on every visit; one effect later the hydrated value is there and
  // still fresh (staleTime), so nothing is fetched. Pages without a prefetch fetch it then.
  const mounted = useMounted();
  const query = useQuery({
    ...meQueries.notificationUnread(browserFetch, scope),
    enabled: mounted,
  });
  return { data: mounted ? query.data : undefined, isError: mounted && query.isError };
}

export type MarkReadInput = { ids: string[] } | { all: true };

type Feed = InfiniteData<NotificationPage>;

/**
 * Marks notifications read (optimistic), then syncs the counters. In the "전체" feed the rows stay
 * and get a `readAt`; in the "안 읽음" feed they leave the list, so its empty state shows at once.
 * With a `scope`, "모두 읽음" covers that audience only and the server's `unread` is the scope's.
 */
export function useMarkNotificationsRead(scope?: NotificationScope) {
  const queryClient = useQueryClient();
  const unreadKey = meKeys.notificationUnreadOf(scope);
  return useMutation({
    mutationFn: (input: MarkReadInput) =>
      api.post('/me/notifications/read', input, {
        query: { scope },
        schema: notificationReadResultSchema,
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: meKeys.notifications });
      const snap = queryClient.getQueriesData({ queryKey: meKeys.notifications });
      const now = new Date().toISOString();
      const hits = (id: string) => ('all' in input ? true : input.ids.includes(id));
      queryClient.setQueryData<Feed>(
        meKeys.notificationFeed('all', scope),
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.map((n) => (!n.readAt && hits(n.id) ? { ...n, readAt: now } : n)),
            })),
          },
      );
      queryClient.setQueryData<Feed>(
        meKeys.notificationFeed('unread', scope),
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: page.items.filter((n) => !hits(n.id)),
            })),
          },
      );
      // The UI only marks unread rows, so every id lowers the counter by one; the server's
      // `unread` (onSuccess) corrects any drift.
      queryClient.setQueryData<number>(unreadKey, (old) =>
        'all' in input ? 0 : old === undefined ? old : Math.max(0, old - input.ids.length),
      );
      return { snap };
    },
    onError: (_error, _vars, context) =>
      context?.snap.forEach(([key, data]) => queryClient.setQueryData(key, data)),
    onSuccess: (result) => {
      if (result?.unread !== undefined) queryClient.setQueryData<number>(unreadKey, result.unread);
    },
    onSettled: (result) => {
      // The unread feed is paginated by the server: rows beyond the loaded pages move up.
      void queryClient.invalidateQueries({ queryKey: meKeys.notificationFeed('unread', scope) });
      if (result?.unread === undefined)
        void queryClient.invalidateQueries({ queryKey: unreadKey, exact: true });
      // The counters of the other audiences (whole feed ↔ console) changed as well.
      void queryClient.invalidateQueries({
        queryKey: meKeys.notificationUnread,
        predicate: (q) => JSON.stringify(q.queryKey) !== JSON.stringify(unreadKey),
      });
    },
  });
}

// ---------- profile ----------

export function useProfile() {
  return useQuery(meQueries.profile(browserFetch));
}

/** PATCH /me/profile. Keeps the cached profile and the session user (header, sidebar) in sync. */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => api.patch('/me/profile', patch, { schema: profileSchema }),
    onSuccess: (profile: Profile) => {
      queryClient.setQueryData<Profile>(meKeys.profile, profile);
      queryClient.setQueryData<SessionUser | null>(
        SESSION_QUERY_KEY,
        (old) =>
          old && {
            ...old,
            nickname: profile.nickname?.trim() || FALLBACK_NICKNAME,
            hasNickname: Boolean(profile.nickname?.trim()),
            phone: profile.phone,
            marketingOptIn: profile.marketingOptIn,
          },
      );
    },
  });
}
