'use client';
import type { ConsentAction } from '@house/shared';
import { useQuery } from '@tanstack/react-query';
import { actionTermsKey, fetchActionTerms } from './consents';

/**
 * The purpose-consent documents of an action, loaded once when the form mounts. They are never
 * refreshed in the background (no stale time, no refetch on focus): the text on screen and the
 * version submitted must stay the one the user read. After AUTH_CONSENT_OUTDATED the form calls
 * `refetch()` and asks for a new agreement.
 */
export function useActionTerms<A extends ConsentAction>(action: A) {
  return useQuery({
    queryKey: actionTermsKey(action),
    queryFn: ({ signal }) => fetchActionTerms(action, signal),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
}
