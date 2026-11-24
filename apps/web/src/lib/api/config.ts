import { API_PREFIX } from '@house/shared';
import { env } from '@/config/env';

/** Path prefix of the API as seen by the browser (same origin). */
export const API_BASE_PATH = env.apiMock ? '/mock-api/v1' : `/${API_PREFIX}`;

/**
 * Absolute API base URL.
 * - Browser: same-origin path (/api/v1, or /mock-api/v1 in mock mode). nginx proxies in prod, next.config rewrites in dev.
 * - Server (RSC, route handlers): INTERNAL_API_URL (http://127.0.0.1:4000) — or this Next server itself in mock mode.
 */
export function apiBaseUrl(): string {
  if (typeof window !== 'undefined') return API_BASE_PATH;
  if (env.apiMock) {
    const self =
      process.env.MOCK_API_ORIGIN ||
      process.env.__NEXT_PRIVATE_ORIGIN ||
      `http://127.0.0.1:${process.env.PORT || 3000}`;
    return `${self.replace(/\/$/, '')}${API_BASE_PATH}`;
  }
  const origin = (process.env.INTERNAL_API_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');
  return `${origin}/${API_PREFIX}`;
}

export type QueryValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly (string | number)[];
export type QueryParams = Record<string, QueryValue>;

/** Serializes query params the way the backend expects: arrays as CSV, empty values dropped. */
export function toQueryString(params?: QueryParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) sp.set(key, value.join(','));
    } else {
      sp.set(key, String(value));
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Builds a full API URL from a resource path like "/listings" (leading slash required). */
export function apiUrl(path: string, query?: QueryParams): string {
  return `${apiBaseUrl()}${path}${toQueryString(query)}`;
}
