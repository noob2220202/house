'use client';
import { UserRole } from '@house/shared';
import { useQuery } from '@tanstack/react-query';
import { useConsoleUser } from '../shell/ConsoleUser';
import { agencyKeys, fetchMyAgency } from './queries';

/**
 * The caller's agency (GET /agencies/mine) for console pages. The layout seeds the cache from its
 * server fetch, so pages render without a skeleton or a second request. For a USER-role caller a
 * 403 means "no agency yet"; an AGENT falls back to the membership (B2).
 */
export function useMyAgency() {
  const user = useConsoleUser();
  const forbiddenAsNone = user?.role === UserRole.USER;
  return useQuery({
    queryKey: agencyKeys.mine,
    queryFn: ({ signal }) => fetchMyAgency(signal, { forbiddenAsNone, role: user?.role }),
  });
}
