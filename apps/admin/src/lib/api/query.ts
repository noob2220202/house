import { QueryClient, isServer } from '@tanstack/react-query';
import { ApiError } from './errors';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        // Never retry auth/validation/not-found errors; retry transient failures twice.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

let browserClient: QueryClient | undefined;

/** One QueryClient per browser tab; a fresh one per server render. */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  browserClient ??= makeQueryClient();
  return browserClient;
}

/**
 * Query key convention: [resource, scope, params]. Example:
 *   queryKey: qk('listings', 'map', { bbox, zoom, deal })
 * Invalidate a whole resource with `queryClient.invalidateQueries({ queryKey: ['listings'] })`.
 */
export function qk(resource: string, scope?: string, params?: unknown): readonly unknown[] {
  return params === undefined
    ? scope === undefined
      ? [resource]
      : [resource, scope]
    : [resource, scope, params];
}
