import 'server-only';
import { cookies } from 'next/headers';
import type { z } from 'zod';
import { apiFetch, type ApiRequestOptions } from './client';
import { ApiError } from './errors';

type ServerOptions<S extends z.ZodType | undefined> = Omit<
  ApiRequestOptions<S>,
  'method' | 'body' | 'next' | 'cache'
> & {
  /** ISR window in seconds for public data (default 60). */
  revalidate?: number | false;
  tags?: string[];
};

/**
 * Public (anonymous) GET from a server component, cached with `revalidate` — use for SEO pages.
 * Does NOT forward cookies, so the page stays statically renderable.
 */
export function serverGet<T = unknown, S extends z.ZodType | undefined = undefined>(
  path: string,
  options: ServerOptions<S> = {},
) {
  const { revalidate = 60, tags, ...rest } = options;
  return apiFetch<T, S>(path, { ...rest, method: 'GET', next: { revalidate, tags } });
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
 * Authenticated GET from a server component: forwards the request cookies and disables caching.
 * Makes the route dynamic — use only on personalised pages (/me, /agent).
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
    headers: { ...options.headers, ...(cookie ? { cookie } : {}) },
  });
}
