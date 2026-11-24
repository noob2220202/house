import 'server-only';
import { QueryClient, dehydrate, type DehydratedState } from '@tanstack/react-query';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { z } from 'zod';
import { authKeys, identityListSchema } from '@/features/w-auth/api';
import { serverGetAuthed } from '@/lib/api/server';
import { getServerSession } from '@/lib/auth/server';
import { loginUrl, signupUrl } from '@/lib/auth/paths';
import type { SessionUser } from '@/lib/auth/types';
import { PREVIEW_FAVORITES, PREVIEW_RECENT, meKeys, meQueries, type MeFetcher } from './queries';

/** One `/auth/me` round trip per request, shared by the /me layout and its pages. */
export const getMeSession = cache(() => getServerSession());

/**
 * Authoritative guard for /me pages (same rules as `requireUser`, but de-duplicated per request):
 * signed out → /login?returnTo=…, signup not finished → /signup?returnTo=….
 * Every page under `app/(me)/me` must call this (or `requireUser`) with its own path so the user
 * comes back to the exact page — the layout cannot know the current URL.
 */
export async function requireMe(returnTo: string): Promise<SessionUser> {
  const user = await getMeSession();
  if (!user) redirect(loginUrl(returnTo));
  if (user.signupCompleted === false) redirect(signupUrl(returnTo));
  return user;
}

// ---------- server prefetch (first paint with data, no skeleton → content swap) ----------

/**
 * A slow API must not hold the HTML back for long: past this the page is sent without that data and
 * the browser fetches it (the views keep their own skeleton / error states). There is deliberately
 * no route-level loading.tsx — it would flash a skeleton on every visit although the data normally
 * arrives with the HTML — so this is also the longest a navigation waits for data.
 */
const PREFETCH_TIMEOUT_MS = 2500;

const serverFetch: MeFetcher = <S extends z.ZodType>(
  path: string,
  options: Parameters<MeFetcher>[1] & { schema: S },
) => serverGetAuthed(path, { ...options, timeoutMs: PREFETCH_TIMEOUT_MS }) as Promise<z.infer<S>>;

type Prefetch = (queryClient: QueryClient) => Promise<unknown>;

/**
 * Runs the given prefetches in parallel on a per-request QueryClient and returns the state for
 * `<HydrationBoundary>`. Failures are dropped (only successful queries are dehydrated), so a broken
 * endpoint degrades to the client-side fetch instead of failing the page.
 */
async function prefetch(...jobs: Prefetch[]): Promise<DehydratedState> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await Promise.allSettled(jobs.map((job) => job(queryClient)));
  return dehydrate(queryClient);
}

const favoriteListings =
  (page: number, pageSize?: number): Prefetch =>
  (qc) =>
    qc.prefetchQuery(meQueries.favoriteListings(serverFetch, page, pageSize));
const favoriteComplexes =
  (page: number, pageSize?: number): Prefetch =>
  (qc) =>
    qc.prefetchQuery(meQueries.favoriteComplexes(serverFetch, page, pageSize));
const recentViews =
  (page: number, pageSize?: number): Prefetch =>
  (qc) =>
    qc.prefetchQuery(meQueries.recentViews(serverFetch, page, pageSize));
const unreadCount: Prefetch = (qc) => qc.prefetchQuery(meQueries.notificationUnread(serverFetch));
/** First page of the feed; its `unreadCount` also seeds the badge counter (no second request). */
const notificationFeed: Prefetch = async (qc) => {
  const options = meQueries.notificationFeed(serverFetch, 'all');
  await qc.prefetchInfiniteQuery(options);
  const count = qc.getQueryData(options.queryKey)?.pages[0]?.unreadCount;
  if (count !== undefined) qc.setQueryData<number>(meKeys.notificationUnread, count);
};

/** MY 홈: counters, favourites preview, recent views, notifications. */
export const prefetchOverview = () =>
  prefetch(
    favoriteListings(1, PREVIEW_FAVORITES),
    favoriteComplexes(1, 1),
    recentViews(1, PREVIEW_RECENT),
    notificationFeed,
  );

/** 관심 매물·단지: the open tab's page plus page 1 of the other tab (its count shows in the tabs). */
export const prefetchFavorites = (tab: 'listings' | 'complexes', page: number) =>
  prefetch(
    favoriteListings(tab === 'listings' ? page : 1),
    favoriteComplexes(tab === 'complexes' ? page : 1),
    unreadCount,
  );

export const prefetchRecent = (page: number) => prefetch(recentViews(page), unreadCount);

export const prefetchNotifications = () => prefetch(notificationFeed);

/** The 연결된 계정 panel (w-auth) reads the same cache entry, so it renders with the page too. */
const identities: Prefetch = (qc) =>
  qc.prefetchQuery({
    queryKey: authKeys.identities(),
    queryFn: () => serverFetch('/me/identities', { schema: identityListSchema }),
  });

export const prefetchProfile = () =>
  prefetch((qc) => qc.prefetchQuery(meQueries.profile(serverFetch)), identities, unreadCount);
