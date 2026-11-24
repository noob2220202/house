import type Redis from 'ioredis';
import { PrismaService } from '../../../prisma/prisma.service';
import { type AdminNotificationKind, type AdminNotificationListQuery, type AdminNotificationPage } from '../schemas';
/** The bell shows the last 30 days; older rows are purged after 90. */
export declare const NOTIFICATION_FEED_DAYS = 30;
export declare const NOTIFICATION_RETENTION_DAYS = 90;
/** Events older than this are not turned into notifications (first deploy, long outages). */
export declare const NOTIFICATION_SYNC_LOOKBACK_DAYS = 7;
/** A deal request still delivered to no office after this long is "waiting for assignment". */
export declare const UNASSIGNED_AFTER_MINUTES = 30;
/** Ads ending within this many days get an "광고 종료 N일 전" notification. */
export declare const AD_EXPIRING_NOTICE_DAYS = 3;
/** Lazy sync runs at most this often (GET /admin/notifications, GET /admin/dashboard). */
export declare const NOTIFICATION_SYNC_INTERVAL_SECONDS = 60;
export interface NotificationDraft {
    kind: AdminNotificationKind;
    title: string;
    body: string | null;
    link: string | null;
    dedupeKey: string;
    createdAt: Date;
}
/** Whole KST calendar days from `now` until `end` (at least 1: "광고 종료 1일 전"). */
export declare function daysUntil(end: Date, now: Date): number;
/**
 * The back-office bell. Notifications are shared by every admin (read state per admin) and are
 * derived from the source tables — new agency applications, new open reports, deal requests no
 * office received, ads about to end — by `sync()`, which runs lazily (throttled to once a minute)
 * when the feed or the dashboard is read and from the admin-maintenance job. `dedupeKey` keeps
 * every event to one row, so re-running the sync is harmless.
 */
export declare class AdminNotificationsService {
    private readonly prisma;
    private readonly redis;
    private readonly logger;
    constructor(prisma: PrismaService, redis: Redis);
    list(adminId: string, q: AdminNotificationListQuery, now?: Date): Promise<AdminNotificationPage>;
    unreadCount(adminId: string, now?: Date): Promise<number>;
    markRead(adminId: string, id: string, now?: Date): Promise<{
        id: string;
        unreadCount: number;
    }>;
    markAllRead(adminId: string, now?: Date): Promise<{
        updated: number;
        unreadCount: number;
    }>;
    private feedWhere;
    /** Keyset cursor `<createdAt ISO>|<id>` (opaque base64url); an unreadable cursor starts over. */
    private cursorWhere;
    /** `sync()` at most once per NOTIFICATION_SYNC_INTERVAL_SECONDS; never fails the caller. */
    syncThrottled(now?: Date): Promise<void>;
    /** Turns recent events into notifications (idempotent). Returns the number of new rows. */
    sync(now?: Date): Promise<number>;
    /** Deletes notifications (and their read markers) past the retention period. */
    purgeExpired(now?: Date): Promise<number>;
    private agencyApplications;
    private receivedReports;
    /** Open reports filed before `since` per target (so "N건째" counts them too). */
    private olderOpenCounts;
    private unassignedDealRequests;
    private expiringAds;
}
