import type { z } from 'zod';
import { apiUrl, type QueryParams } from './config';
import { CSRF_HEADER, getCsrfToken } from './csrf';
import { ApiError, ERROR_CODES, normalizeError, toApiError } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiRequestOptions<S extends z.ZodType | undefined = undefined> {
  method?: HttpMethod;
  query?: QueryParams;
  /** JSON body (plain object) or FormData (uploads). */
  body?: unknown;
  /** zod schema for the response — use @house/shared schemas when they exist. */
  schema?: S;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Abort after N ms (default 15000). */
  timeoutMs?: number;
  /** Server-side only: Next fetch cache options (revalidate/tags). */
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
}

type Result<S extends z.ZodType | undefined, T> = S extends z.ZodType ? z.infer<S> : T;

const MUTATING = new Set<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE']);

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return undefined;
  const text = await res.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

/**
 * The one typed API call. Sends credentials, JSON, the CSRF header on mutations, parses the response
 * with the given zod schema and throws `ApiError { code, message, status }` on any failure.
 *
 *   const page = await apiFetch('/listings', { query: { page: 1 }, schema: listingPageSchema });
 */
export async function apiFetch<T = unknown, S extends z.ZodType | undefined = undefined>(
  path: string,
  options: ApiRequestOptions<S> = {},
): Promise<Result<S, T>> {
  const {
    method = 'GET',
    query,
    body,
    schema,
    signal,
    headers = {},
    timeoutMs = 15000,
    next,
    cache,
  } = options;
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const finalHeaders: Record<string, string> = { accept: 'application/json', ...headers };
  if (body !== undefined && !isForm) finalHeaders['content-type'] = 'application/json';

  const send = async (retryCsrf: boolean): Promise<Response> => {
    if (MUTATING.has(method) && typeof window !== 'undefined') {
      const token = await getCsrfToken(retryCsrf);
      if (token) finalHeaders[CSRF_HEADER] = token;
    }
    const timeout = AbortSignal.timeout(timeoutMs);
    const init: RequestInit & { next?: ApiRequestOptions['next'] } = {
      method,
      headers: finalHeaders,
      credentials: 'include',
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    };
    if (next) init.next = next;
    if (cache) init.cache = cache;
    return fetch(apiUrl(path, query), init);
  };

  let res: Response;
  try {
    res = await send(false);
    // The CSRF cookie may have expired — refresh once and retry.
    if (res.status === 403 && MUTATING.has(method) && typeof window !== 'undefined') {
      const peek: unknown = await res
        .clone()
        .json()
        .catch(() => null);
      const code = (peek as { code?: string } | null)?.code ?? '';
      if (code.includes('CSRF')) res = await send(true);
    }
  } catch (error) {
    throw normalizeError(error);
  }

  const data = await parseBody(res);
  if (!res.ok) throw toApiError(res.status, data);
  if (!schema) return data as Result<S, T>;
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(
        `[api] response of ${method} ${path} does not match the schema`,
        parsed.error.issues,
      );
    }
    throw new ApiError(502, {
      code: ERROR_CODES.BAD_RESPONSE,
      message: '서버 응답을 해석하지 못했어요. 잠시 후 다시 시도해 주세요.',
    });
  }
  return parsed.data as Result<S, T>;
}

type BodylessOptions<S extends z.ZodType | undefined> = Omit<
  ApiRequestOptions<S>,
  'method' | 'body'
>;

/** Convenience verbs: `api.get('/complexes/1', { schema })`, `api.post('/favorites', { listingId })`. */
export const api = {
  get: <T = unknown, S extends z.ZodType | undefined = undefined>(
    path: string,
    options?: BodylessOptions<S>,
  ) => apiFetch<T, S>(path, { ...options, method: 'GET' }),
  post: <T = unknown, S extends z.ZodType | undefined = undefined>(
    path: string,
    body?: unknown,
    options?: BodylessOptions<S>,
  ) => apiFetch<T, S>(path, { ...options, method: 'POST', body }),
  put: <T = unknown, S extends z.ZodType | undefined = undefined>(
    path: string,
    body?: unknown,
    options?: BodylessOptions<S>,
  ) => apiFetch<T, S>(path, { ...options, method: 'PUT', body }),
  patch: <T = unknown, S extends z.ZodType | undefined = undefined>(
    path: string,
    body?: unknown,
    options?: BodylessOptions<S>,
  ) => apiFetch<T, S>(path, { ...options, method: 'PATCH', body }),
  delete: <T = unknown, S extends z.ZodType | undefined = undefined>(
    path: string,
    options?: BodylessOptions<S>,
  ) => apiFetch<T, S>(path, { ...options, method: 'DELETE' }),
};
