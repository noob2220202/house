import { NotificationType } from '@house/shared';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
/**
 * Audience of a notification (B5). One feed per user, but brokers are ordinary users too: rows
 * addressed to them as a member of an agency carry `data.agencyId`; everything else is personal.
 */
export declare const NotificationScope: {
    readonly AGENCY: "agency";
    readonly PERSONAL: "personal";
};
export type NotificationScope = (typeof NotificationScope)[keyof typeof NotificationScope];
/**
 * Types only ever sent to agency members. Rows of these types count as `agency` even without
 * `data.agencyId` (rows written before B5, and the listings module's direct writes of
 * LISTING_EXPIRED / CO_BROKER_REQUESTED, which carry only `listingId`). Mirrors the web
 * `AGENCY_ONLY_TYPES` (apps/web/src/features/w-me/lib/notifications.ts) plus LISTING_HIDDEN.
 */
export declare const AGENCY_ONLY_NOTIFICATION_TYPES: readonly NotificationType[];
/** Listing notices addressed to the listing's primary agency (agencyId resolved from listingId). */
export declare const LISTING_AGENCY_NOTIFICATION_TYPES: readonly NotificationType[];
/** `?scope=agency|personal` (local twin of the shared list query; shared has no scope yet). */
export declare const notificationScopeQuerySchema: z.ZodObject<{
    scope: z.ZodOptional<z.ZodEnum<{
        agency: "agency";
        personal: "personal";
    }>>;
}, z.core.$strip>;
export declare const notificationFeedQuerySchema: z.ZodObject<{
    cursor: z.ZodOptional<z.ZodString>;
    limit: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    unreadOnly: z.ZodPreprocess<z.ZodOptional<z.ZodBoolean>, unknown>;
    scope: z.ZodOptional<z.ZodEnum<{
        agency: "agency";
        personal: "personal";
    }>>;
}, z.core.$strip>;
export type NotificationFeedQuery = z.infer<typeof notificationFeedQuerySchema>;
/**
 * Prisma filter of a scope. `agency` = `data.agencyId` is a string OR an agency-only type;
 * `personal` = neither. Written without NOT: `NOT (json path LIKE …)` is NULL (→ excluded) for
 * rows whose `data` is NULL or lacks the key, so `personal` uses an explicit "path is null".
 */
export declare function notificationScopeWhere(scope: NotificationScope | undefined): Prisma.NotificationWhereInput;
