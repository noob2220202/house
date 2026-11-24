import { env } from '@/config/env';
import { ApiError } from '@/lib/api/errors';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Mock-mode-only switches for exercising the non-happy states of a page from the URL:
 *   ?_empty=1  → the mock list answers with no items (empty state)
 *   ?_delay=ms → slower mock response (loading skeleton)
 *   ?_error=1  → the fetch fails with a 500 (error state)
 * Ignored entirely when NEXT_PUBLIC_API_MOCK is off.
 */
export function devSwitches(searchParams: SearchParams): {
  query: Record<string, string | undefined>;
  failIfRequested: () => void;
} {
  const pick = (key: string): string | undefined => {
    const v = searchParams[key];
    return env.apiMock && typeof v === 'string' ? v : undefined;
  };
  const fail = pick('_error') !== undefined;
  return {
    query: { _empty: pick('_empty'), _delay: pick('_delay') },
    failIfRequested: () => {
      if (fail) {
        throw new ApiError(500, {
          code: 'INTERNAL_ERROR',
          message: '일시적인 오류가 발생했습니다.',
          requestId: 'mock-dev-error',
        });
      }
    },
  };
}
