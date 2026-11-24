'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * List filters in the URL query string (shareable, back-button friendly). Values equal to their
 * default are left out of the URL. Changing any filter except `page` resets `page`.
 *
 *   const [state, setState] = useUrlState({ q: '', status: 'all', page: '1' });
 */
export function useUrlState<K extends string>(
  defaults: Record<K, string>,
): [Record<K, string>, (patch: Partial<Record<K, string>>) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const keys = Object.keys(defaults) as K[];
  const signature = keys.map((k) => `${k}=${searchParams.get(k) ?? ''}`).join('&');

  const state = useMemo(() => {
    const out = {} as Record<K, string>;
    for (const key of keys) out[key] = searchParams.get(key) ?? defaults[key];
    return out;
  }, [signature]);

  const setState = useCallback(
    (patch: Partial<Record<K, string>>) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!('page' in patch) && 'page' in defaults) next.delete('page');
      for (const [key, value] of Object.entries(patch) as [K, string | undefined][]) {
        if (value === undefined || value === '' || value === defaults[key]) next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return [state, setState];
}
