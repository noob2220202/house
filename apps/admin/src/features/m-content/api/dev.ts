'use client';
import { useEffect, useState } from 'react';
import { env } from '@/config/env';
import type { QueryParams } from '@/lib/api';

const KEYS = ['_empty', '_error', '_delay', '_degraded'] as const;

/**
 * MOCK MODE ONLY: forwards the dev switches of the page URL (`?_empty=1`, `?_error=1`,
 * `?_delay=1500`, `?_degraded=1`) to the API calls of the screen so empty / error / loading states can be checked.
 * Returns `{}` in production and when no switch is present.
 */
export function useDevQuery(): QueryParams {
  const [params, setParams] = useState<QueryParams>({});
  useEffect(() => {
    if (!env.apiMock) return;
    const sp = new URLSearchParams(window.location.search);
    const next: Record<string, string> = {};
    for (const key of KEYS) {
      const value = sp.get(key);
      if (value) next[key] = value;
    }
    if (Object.keys(next).length > 0) setParams(next);
  }, []);
  return params;
}
