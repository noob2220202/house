import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { z } from 'zod';
import type { QueryParams } from '@/lib/api/config';
import {
  favoriteComplexPageSchema,
  favoriteListingPageSchema,
  notificationPageSchema,
  notificationUnreadSchema,
  profileSchema,
  recentViewPageSchema,
  type NotificationPage,
} from './schemas';

/**
 * Query keys and query definitions of the my-page resources — plain module (no 'use client', no
 * 'server-only') so the browser hooks (`api.ts`) and the server prefetch (`server.ts`) build the
 * SAME keys and requests. A key that differs between the two silently disables hydration.
 */

export type NotificationFilter = 'all' | 'unread';

/**
 * Audience of a notification feed (B5, `?scope=` of /me/notifications*): `agency` = rows addressed
 * to the user as a member of an agency (the console), `personal` = everything else. Omitted = all.
 */
export type NotificationScope = 'agency' | 'personal';

/** Page sizes: part of the query keys, so both sides must use these constants. */
export const FAVORITES_PAGE_SIZE = 12;
export const RECENT_PAGE_SIZE = 24;
export const NOTIFICATION_PAGE_SIZE = 10;
/** Overview previews. */
export const PREVIEW_FAVORITES = 3;
export const PREVIEW_RECENT = 4;
export const PREVIEW_NOTIFICATIONS = 4;

interface PageParams {
  page: number;
  pageSize: number;
}

const meKeysUnread = ['me-notifications', 'unread'] as const;

/** Query keys of the my-page resources (`[resource, scope, params]`). */
export const meKeys = {
  favorites: ['me-favorites'] as const,
  favoriteListings: (params?: PageParams) =>
    params
      ? (['me-favorites', 'listings', params] as const)
      : (['me-favorites', 'listings'] as const),
  favoriteComplexes: (params?: PageParams) =>
    params
      ? (['me-favorites', 'complexes', params] as const)
      : (['me-favorites', 'complexes'] as const),
  recentViews: (params?: PageParams) =>
    params ? (['me-recent-views', 'list', params] as const) : (['me-recent-views'] as const),
  notifications: ['me-notifications'] as const,
  notificationFeeds: ['me-notifications', 'feed'] as const,
  notificationFeed: (filter: NotificationFilter, scope?: NotificationScope) =>
    scope
      ? (['me-notifications', 'feed', filter, scope] as const)
      : (['me-notifications', 'feed', filter] as const),
  /** Unread counter of the whole feed (badges of the my-page and the site header). */
  notificationUnread: ['me-notifications', 'unread'] as const,
  notificationUnreadOf: (scope?: NotificationScope) =>
    scope ? (['me-notifications', 'unread', scope] as const) : meKeysUnread,
  profile: ['me-profile'] as const,
};

/**
 * Typed GET: `api.get` in the browser, `serverGetAuthed` (cookies forwarded) in server components.
 */
export type MeFetcher = <S extends z.ZodType>(
  path: string,
  options: { query?: QueryParams; schema: S; signal?: AbortSignal },
) => Promise<z.infer<S>>;

export const meQueries = {
  favoriteListings: (fetcher: MeFetcher, page = 1, pageSize = FAVORITES_PAGE_SIZE) =>
    queryOptions({
      queryKey: meKeys.favoriteListings({ page, pageSize }),
      queryFn: ({ signal }) =>
        fetcher('/me/favorites/listings', {
          query: { page, pageSize },
          schema: favoriteListingPageSchema,
          signal,
        }),
    }),
  favoriteComplexes: (fetcher: MeFetcher, page = 1, pageSize = FAVORITES_PAGE_SIZE) =>
    queryOptions({
      queryKey: meKeys.favoriteComplexes({ page, pageSize }),
      queryFn: ({ signal }) =>
        fetcher('/me/favorites/complexes', {
          query: { page, pageSize },
          schema: favoriteComplexPageSchema,
          signal,
        }),
    }),
  recentViews: (fetcher: MeFetcher, page = 1, pageSize = RECENT_PAGE_SIZE) =>
    queryOptions({
      queryKey: meKeys.recentViews({ page, pageSize }),
      queryFn: ({ signal }) =>
        fetcher('/me/recent-views', {
          query: { targetType: 'LISTING', page, pageSize },
          schema: recentViewPageSchema,
          signal,
        }),
    }),
  /** `onPage` sees every fetched page (the browser hook syncs the unread counter from it). */
  notificationFeed: (
    fetcher: MeFetcher,
    filter: NotificationFilter,
    onPage?: (page: NotificationPage) => void,
    scope?: NotificationScope,
  ) =>
    infiniteQueryOptions({
      queryKey: meKeys.notificationFeed(filter, scope),
      queryFn: async ({ pageParam, signal }) => {
        const page = await fetcher('/me/notifications', {
          query: {
            cursor: pageParam ?? undefined,
            limit: NOTIFICATION_PAGE_SIZE,
            unreadOnly: filter === 'unread' ? true : undefined,
            scope,
          },
          schema: notificationPageSchema,
          signal,
        });
        onPage?.(page);
        return page;
      },
      initialPageParam: null as string | null,
      getNextPageParam: (last) => last.nextCursor,
    }),
  /** Unread counter on its own (GET /me/notifications/unread-count → `{ unread }`). */
  notificationUnread: (fetcher: MeFetcher, scope?: NotificationScope) =>
    queryOptions({
      queryKey: meKeys.notificationUnreadOf(scope),
      queryFn: async ({ signal }): Promise<number> => {
        const { unread } = await fetcher('/me/notifications/unread-count', {
          query: { scope },
          schema: notificationUnreadSchema,
          signal,
        });
        return unread;
      },
      staleTime: 60_000,
    }),
  profile: (fetcher: MeFetcher) =>
    queryOptions({
      queryKey: meKeys.profile,
      queryFn: ({ signal }) => fetcher('/me/profile', { schema: profileSchema, signal }),
    }),
};
