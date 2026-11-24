import 'server-only';
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
 * Public (anonymous) GET from a server component.
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
 * User-Agent, and disables caching. Makes the route dynamic (every console page is).
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
