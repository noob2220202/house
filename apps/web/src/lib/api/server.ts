import 'server-only';
import { unstable_cache } from 'next/cache';
import { cookies, headers } from 'next/headers';
import type { z } from 'zod';
import { apiFetch, type ApiRequestOptions } from './client';
import { ApiError } from './errors';
import { SSR_MARKER, visitorHeaders } from './forward';

type ServerOptions<S extends z.ZodType | undefined> = Omit<
  ApiRequestOptions<S>,
  'method' | 'body' | 'next' | 'cache'
> & {
  /**
   * Data-cache window in seconds for public data (default 60). `0` = not cached: fetched per
   * request (`no-store`) on behalf of the visitor — use it for unbounded inputs such as free text.
   */
  revalidate?: number | false;
  tags?: string[];
};

/** Visitor headers of the request being rendered (makes the route dynamic, like `cookies()`). */
async function requestVisitorHeaders(): Promise<Record<string, string>> {
  return visitorHeaders(await headers());
}

/**
 * Public (anonymous) GET from a server component — use for SEO pages.
 * Does NOT forward cookies. Cached reads (`revalidate` > 0 or false) are shared by every visitor:
 * they carry only the `x-house-ssr` marker, so the page stays statically renderable and the fetch
 * cache has one entry per URL. `revalidate: 0` reads are per request and forward the visitor's IP
 * and User-Agent (see ./forward).
 */
export async function serverGet<T = unknown, S extends z.ZodType | undefined = undefined>(
  path: string,
  options: ServerOptions<S> = {},
) {
  const { revalidate = 60, tags, headers: extra, ...rest } = options;
  if (revalidate === 0) {
    return apiFetch<T, S>(path, {
      ...rest,
      method: 'GET',
      cache: 'no-store',
      headers: { ...extra, ...(await requestVisitorHeaders()) },
    });
  }
  return apiFetch<T, S>(path, {
    ...rest,
    method: 'GET',
    next: { revalidate, tags },
    headers: { ...extra, ...SSR_MARKER },
  });
}

/**
 * Public detail read that can turn into a 404 (a listing hidden or deleted, an office no longer
 * public, a 단지 removed): the parsed body, or null for 404 / 400 (malformed id).
 *
 * The OUTCOME is cached (`unstable_cache`, `revalidate` s, `tags`), not the response, and the
 * inner fetch is not cached: Next's fetch cache stores only 200s, so once a 200 had been cached a
 * later 404 never replaced it and the gone page was served until a restart (D-E). Same pattern
 * as the office site (features/w-site/api/server.ts). Other errors throw and are not cached.
 */
export function serverGetDetail<S extends z.ZodType>(
  path: string,
  options: { schema: S; revalidate: number; tags: string[]; timeoutMs?: number },
): Promise<z.infer<S> | null> {
  const { schema, revalidate, tags, timeoutMs } = options;
  return unstable_cache(
    async (): Promise<z.infer<S> | null> => {
      try {
        const data = await apiFetch<unknown, S>(path, {
          method: 'GET',
          cache: 'no-store',
          schema,
          timeoutMs,
          headers: { ...SSR_MARKER },
        });
        return data as z.infer<S>;
      } catch (error) {
        if (error instanceof ApiError && (error.isNotFound || error.status === 400)) return null;
        throw error;
      }
    },
    ['api-detail', path],
    { revalidate, tags },
  )();
}

/**
 * Like `serverGet` but resolves to `fallback` when the API is unreachable or errors (the page still
 * renders — and `next build` works without a running backend). 404s also return the fallback; use
 * `serverGet` + `notFound()` when a missing resource must 404.
 */
export async function serverGetOr<T, S extends z.ZodType | undefined = undefined>(
  path: string,
  fallback: T,
  options: ServerOptions<S> = {},
) {
  try {
    return await serverGet<T, S>(path, options);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return fallback;
  }
}

/**
 * Authenticated GET from a server component: forwards the request cookies and the visitor's IP /
 * User-Agent, and disables caching. Makes the route dynamic — use only on personalised pages
 * (/me, /agent).
 */
export async function serverGetAuthed<T = unknown, S extends z.ZodType | undefined = undefined>(
  path: string,
  options: Omit<ServerOptions<S>, 'revalidate' | 'tags'> = {},
) {
  const jar = await cookies();
  const cookie = jar
    .getAll()
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join('; ');
  return apiFetch<T, S>(path, {
    ...options,
    method: 'GET',
    cache: 'no-store',
    headers: {
      ...options.headers,
      ...(await requestVisitorHeaders()),
      ...(cookie ? { cookie } : {}),
    },
  });
}
