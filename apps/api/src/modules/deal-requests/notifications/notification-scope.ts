import { NotificationType, notificationListQuerySchema } from '@house/shared';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

/**
 * Audience of a notification (B5). One feed per user, but brokers are ordinary users too: rows
 * addressed to them as a member of an agency carry `data.agencyId`; everything else is personal.
 */
export const NotificationScope = { AGENCY: 'agency', PERSONAL: 'personal' } as const;
export type NotificationScope = (typeof NotificationScope)[keyof typeof NotificationScope];

/**
 * Types only ever sent to agency members. Rows of these types count as `agency` even without
 * `data.agencyId` (rows written before B5, and the listings module's direct writes of
 * LISTING_EXPIRED / CO_BROKER_REQUESTED, which carry only `listingId`). Mirrors the web
 * `AGENCY_ONLY_TYPES` (apps/web/src/features/w-me/lib/notifications.ts) plus LISTING_HIDDEN.
 */
export const AGENCY_ONLY_NOTIFICATION_TYPES: readonly NotificationType[] = [
  NotificationType.DEAL_REQUEST_RECEIVED,
  NotificationType.PROPOSAL_ACCEPTED,
  NotificationType.CONTACT_GRANTED,
  NotificationType.LISTING_EXPIRED,
  NotificationType.CO_BROKER_REQUESTED,
  NotificationType.LISTING_HIDDEN,
];

/** Listing notices addressed to the listing's primary agency (agencyId resolved from listingId). */
export const LISTING_AGENCY_NOTIFICATION_TYPES: readonly NotificationType[] = [
  NotificationType.LISTING_HIDDEN,
  NotificationType.LISTING_EXPIRED,
  NotificationType.CO_BROKER_REQUESTED,
];

const scopeSchema = z.enum([NotificationScope.AGENCY, NotificationScope.PERSONAL]).optional();

/** `?scope=agency|personal` (local twin of the shared list query; shared has no scope yet). */
export const notificationScopeQuerySchema = z.object({ scope: scopeSchema });
export const notificationFeedQuerySchema = notificationListQuerySchema.extend({
  scope: scopeSchema,
});
export type NotificationFeedQuery = z.infer<typeof notificationFeedQuerySchema>;

/**
 * Prisma filter of a scope. `agency` = `data.agencyId` is a string OR an agency-only type;
 * `personal` = neither. Written without NOT: `NOT (json path LIKE …)` is NULL (→ excluded) for
 * rows whose `data` is NULL or lacks the key, so `personal` uses an explicit "path is null".
 */
export function notificationScopeWhere(
  scope: NotificationScope | undefined,
): Prisma.NotificationWhereInput {
  if (scope === NotificationScope.AGENCY) {
    return {
      OR: [
        { data: { path: ['agencyId'], string_starts_with: '' } },
        { type: { in: [...AGENCY_ONLY_NOTIFICATION_TYPES] } },
      ],
    };
  }
  if (scope === NotificationScope.PERSONAL) {
    return {
      type: { notIn: [...AGENCY_ONLY_NOTIFICATION_TYPES] },
      data: { path: ['agencyId'], equals: Prisma.AnyNull },
    };
  }
  return {};
}
