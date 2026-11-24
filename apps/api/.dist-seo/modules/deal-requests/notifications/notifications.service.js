"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var NotificationsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsService = void 0;
exports.parseCursor = parseCursor;
const common_1 = require("@nestjs/common");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const deal_request_mapper_1 = require("../deal-request.mapper");
const deal_request_selects_1 = require("../deal-request.selects");
const notification_dispatcher_1 = require("./notification-dispatcher");
const notification_scope_1 = require("./notification-scope");
/**
 * In-app notifications (the `notifications` table) for the current user, plus the write side
 * used by deal-request flows. Writes join the caller's transaction; external delivery happens via
 * `dispatch()` after commit.
 */
let NotificationsService = NotificationsService_1 = class NotificationsService {
    constructor(prisma, mapper, dispatcher) {
        this.prisma = prisma;
        this.mapper = mapper;
        this.dispatcher = dispatcher;
        this.logger = new common_1.Logger(NotificationsService_1.name);
    }
    /**
     * One notification per distinct user id (personal audience). Listing notices addressed to an
     * agency (LISTING_HIDDEN …) get `data.agencyId` of the listing's primary agency.
     */
    async createFor(userIds, input, db = this.prisma) {
        const ids = [...new Set(userIds)];
        if (ids.length === 0)
            return [];
        return this.createEach(ids.map((userId) => ({ ...input, userId })), db);
    }
    /**
     * One notification per member of an agency (deduplicated by user, first agency wins): every row
     * carries `data.agencyId`, so the console and the my-page can tell agency events apart (B5).
     */
    async createForMembers(recipients, input, db = this.prisma) {
        const byUser = new Map();
        for (const r of recipients)
            if (!byUser.has(r.userId))
                byUser.set(r.userId, r.agencyId);
        if (byUser.size === 0)
            return [];
        return this.createEach([...byUser].map(([userId, agencyId]) => ({
            ...input,
            userId,
            data: { ...input.data, agencyId },
        })), db);
    }
    /** One notification per item (per-recipient payloads). */
    async createEach(items, db = this.prisma) {
        if (items.length === 0)
            return [];
        const withAgency = await this.withListingAgency(items, db);
        return db.notification.createManyAndReturn({
            data: withAgency.map((i) => ({
                userId: i.userId,
                type: i.type,
                title: i.title,
                body: i.body ?? null,
                data: i.data ?? undefined,
            })),
            select: { id: true, userId: true, type: true, title: true, body: true },
        });
    }
    /**
     * Listing notices written by other modules (admin hide, report resolution) carry only
     * `listingId`; they are addressed to the primary agency's owner, so add its `agencyId`.
     */
    async withListingAgency(items, db) {
        const listingIdOf = (i) => {
            if (!notification_scope_1.LISTING_AGENCY_NOTIFICATION_TYPES.includes(i.type))
                return null;
            if (typeof i.data?.agencyId === 'string')
                return null;
            const id = i.data?.listingId;
            return typeof id === 'string' ? id : null;
        };
        const listingIds = [...new Set(items.map(listingIdOf).filter((v) => !!v))];
        if (listingIds.length === 0)
            return [...items];
        const rows = await db.listing.findMany({
            where: { id: { in: listingIds } },
            select: { id: true, primaryAgencyId: true },
        });
        const agencyOf = new Map(rows.map((r) => [r.id, r.primaryAgencyId]));
        return items.map((i) => {
            const listingId = listingIdOf(i);
            const agencyId = listingId ? agencyOf.get(listingId) : undefined;
            return agencyId ? { ...i, data: { ...i.data, agencyId } } : i;
        });
    }
    /** Best-effort external delivery; never fails the caller. */
    async dispatch(rows) {
        if (rows.length === 0)
            return;
        try {
            await this.dispatcher.dispatch(rows);
        }
        catch (err) {
            this.logger.warn({ err, count: rows.length }, 'notification dispatch failed');
        }
    }
    async list(userId, q) {
        const cursor = parseCursor((0, pagination_1.decodeCursor)(q.cursor));
        const where = {
            userId,
            ...(0, notification_scope_1.notificationScopeWhere)(q.scope),
            ...(q.unreadOnly ? { readAt: null } : {}),
            ...(cursor
                ? {
                    OR: [
                        { createdAt: { lt: cursor.createdAt } },
                        { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                    ],
                }
                : {}),
        };
        const [rows, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where,
                select: deal_request_selects_1.notificationSelect,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: q.limit + 1,
            }),
            this.unreadCount(userId, q.scope),
        ]);
        const page = (0, pagination_1.toCursorPage)(rows, q.limit, (r) => `${r.createdAt.toISOString()}|${r.id}`);
        return {
            items: page.items.map((n) => this.mapper.notification(n)),
            nextCursor: page.nextCursor,
            unreadCount,
        };
    }
    /** Unread rows of the user, optionally of one audience (same filter as the feed). */
    unreadCount(userId, scope) {
        return this.prisma.notification.count({
            where: { userId, readAt: null, ...(0, notification_scope_1.notificationScopeWhere)(scope) },
        });
    }
    /**
     * Marks `ids` (or all) read. With `scope`, `all` only covers that audience and `unread` is the
     * count of that audience, so the console's "모두 읽음" never touches the personal feed.
     */
    async markRead(userId, input, scope, now = new Date()) {
        const { count } = await this.prisma.notification.updateMany({
            where: {
                userId,
                readAt: null,
                ...(input.ids ? { id: { in: input.ids } } : (0, notification_scope_1.notificationScopeWhere)(scope)),
            },
            data: { readAt: now },
        });
        return { updated: count, unread: await this.unreadCount(userId, scope) };
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = NotificationsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)(notification_dispatcher_1.NOTIFICATION_DISPATCHER)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        deal_request_mapper_1.DealRequestMapper, Object])
], NotificationsService);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** "<iso>|<uuid>" → keyset position; malformed cursors restart from the top. */
function parseCursor(raw) {
    if (!raw)
        return null;
    const sep = raw.lastIndexOf('|');
    if (sep < 0)
        return null;
    const createdAt = new Date(raw.slice(0, sep));
    const id = raw.slice(sep + 1);
    if (Number.isNaN(createdAt.getTime()) || !UUID.test(id))
        return null;
    return { createdAt, id };
}
//# sourceMappingURL=notifications.service.js.map