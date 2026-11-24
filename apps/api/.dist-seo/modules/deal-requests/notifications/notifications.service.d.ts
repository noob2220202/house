import type { CursorPage, NotificationReadInput, NotificationReadResult, NotificationType, NotificationView } from '@house/shared';
import type { Prisma } from '@prisma/client';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
import { DealRequestMapper } from '../deal-request.mapper';
import { type DispatchableNotification, type NotificationDispatcher } from './notification-dispatcher';
import { type NotificationFeedQuery, type NotificationScope } from './notification-scope';
export interface NotificationInput {
    type: NotificationType;
    title: string;
    body?: string | null;
    /** Deep-link ids only — never contact or other PII. */
    data?: Prisma.InputJsonObject;
}
/** A recipient addressed as a member of an agency: the row gets `data.agencyId` (B5). */
export interface MemberRecipient {
    userId: string;
    agencyId: string;
}
/** The feed page plus the unread count of the same scope (the web badges read it from here). */
export interface NotificationFeedPage extends CursorPage<NotificationView> {
    unreadCount: number;
}
/**
 * In-app notifications (the `notifications` table) for the current user, plus the write side
 * used by deal-request flows. Writes join the caller's transaction; external delivery happens via
 * `dispatch()` after commit.
 */
export declare class NotificationsService {
    private readonly prisma;
    private readonly mapper;
    private readonly dispatcher;
    private readonly logger;
    constructor(prisma: PrismaService, mapper: DealRequestMapper, dispatcher: NotificationDispatcher);
    /**
     * One notification per distinct user id (personal audience). Listing notices addressed to an
     * agency (LISTING_HIDDEN …) get `data.agencyId` of the listing's primary agency.
     */
    createFor(userIds: readonly string[], input: NotificationInput, db?: PrismaTx): Promise<DispatchableNotification[]>;
    /**
     * One notification per member of an agency (deduplicated by user, first agency wins): every row
     * carries `data.agencyId`, so the console and the my-page can tell agency events apart (B5).
     */
    createForMembers(recipients: readonly MemberRecipient[], input: NotificationInput, db?: PrismaTx): Promise<DispatchableNotification[]>;
    /** One notification per item (per-recipient payloads). */
    createEach(items: readonly (NotificationInput & {
        userId: string;
    })[], db?: PrismaTx): Promise<DispatchableNotification[]>;
    /**
     * Listing notices written by other modules (admin hide, report resolution) carry only
     * `listingId`; they are addressed to the primary agency's owner, so add its `agencyId`.
     */
    private withListingAgency;
    /** Best-effort external delivery; never fails the caller. */
    dispatch(rows: readonly DispatchableNotification[]): Promise<void>;
    list(userId: string, q: NotificationFeedQuery): Promise<NotificationFeedPage>;
    /** Unread rows of the user, optionally of one audience (same filter as the feed). */
    unreadCount(userId: string, scope?: NotificationScope): Promise<number>;
    /**
     * Marks `ids` (or all) read. With `scope`, `all` only covers that audience and `unread` is the
     * count of that audience, so the console's "모두 읽음" never touches the personal feed.
     */
    markRead(userId: string, input: NotificationReadInput, scope?: NotificationScope, now?: Date): Promise<NotificationReadResult>;
}
/** "<iso>|<uuid>" → keyset position; malformed cursors restart from the top. */
export declare function parseCursor(raw: string | null): {
    createdAt: Date;
    id: string;
} | null;
