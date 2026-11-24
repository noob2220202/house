'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import {
  parseListParams,
  patchListParams,
  serializeListParams,
  type ParamSpec,
  type ParamValues,
} from './list-params';

export interface ListParamsApi<S extends ParamSpec> {
  values: ParamValues<S>;
  /** Merge a patch into the URL. Filters push a history entry; typing in search replaces it. */
  set: (patch: Partial<ParamValues<S>>, options?: { replace?: boolean }) => void;
  /** Back to the unfiltered list (optionally keeping some keys, e.g. the tab). */
  reset: (keep?: Partial<ParamValues<S>>) => void;
  /** Href of the same list with a patch applied (tab links, pagination links). */
  hrefFor: (patch: Partial<ParamValues<S>>) => string;
}

/** List state lives in the URL query string (shareable, back-button friendly). */
export function useListParams<S extends ParamSpec>(spec: S): ListParamsApi<S> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const values = useMemo(() => parseListParams(searchParams, spec), [searchParams, spec]);

  const hrefFor = useCallback(
    (patch: Partial<ParamValues<S>>) =>
      `${pathname}${serializeListParams(patchListParams(values, patch), spec)}`,
    [pathname, values, spec],
  );
  const set = useCallback<ListParamsApi<S>['set']>(
    (patch, options) => {
      const href = hrefFor(patch);
      if (options?.replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [hrefFor, router],
  );
  const reset = useCallback<ListParamsApi<S>['reset']>(
    (keep) => {
      const empty = parseListParams(new URLSearchParams(), spec);
      router.push(`${pathname}${serializeListParams({ ...empty, ...keep }, spec)}`, {
        scroll: false,
      });
    },
    [pathname, router, spec],
  );
  return { values, set, reset, hrefFor };
}
