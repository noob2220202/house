import type { NextRequest } from 'next/server';
import { isAgencyNotification } from '@/features/w-me/lib/notifications';
import type { Notification } from '@/features/w-me/schemas';
import type { MockRole } from '@/lib/mock';
import { ensureAgencyNotifications } from '../../agency/deal-requests/_store';

/** Brokers' feeds carry the agency events of the console mock (added once per role). */
export function prepareFeed(role: MockRole): void {
  ensureAgencyNotifications(role);
}

/**
 * `?scope=agency|personal` of /me/notifications* (B5, deal-requests `notification-scope.ts`):
 * `agency` = rows with `data.agencyId` or of an agency-only type, `personal` = the others,
 * anything else = the whole feed.
 */
export function scopeFilter(req: NextRequest): (n: Notification) => boolean {
  const scope = req.nextUrl.searchParams.get('scope');
  if (scope === 'agency') return (n) => isAgencyNotification(n);
  if (scope === 'personal') return (n) => !isAgencyNotification(n);
  return () => true;
}

export const unreadOf = (rows: readonly Notification[], inScope: (n: Notification) => boolean) =>
  rows.filter((n) => !n.readAt && inScope(n)).length;
