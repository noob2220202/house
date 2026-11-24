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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencyInboxService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const pagination_1 = require("../../../common/pagination/pagination");
const prisma_service_1 = require("../../../prisma/prisma.service");
const deal_request_mapper_1 = require("../deal-request.mapper");
const deal_request_selects_1 = require("../deal-request.selects");
const agency_actor_service_1 = require("./agency-actor.service");
const deal_request_access_1 = require("./deal-request-access");
/**
 * The agency inbox (/agency/deal-requests). Requests are filtered by the visibility rule; contact
 * fields are loaded in a separate query only for requests whose requester granted this agency.
 */
let AgencyInboxService = class AgencyInboxService {
    constructor(prisma, mapper, actors) {
        this.prisma = prisma;
        this.mapper = mapper;
        this.actors = actors;
    }
    async list(user, q, now = new Date()) {
        const actor = await this.actors.resolve(user);
        const where = (0, deal_request_access_1.agencyInboxWhere)(actor, q, now);
        const select = (0, deal_request_selects_1.dealRequestAgencySelect)(actor.agencyId);
        const page = await (0, pagination_1.paginate)(q, (args) => this.prisma.dealRequest.findMany({
            where,
            select,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            ...args,
        }), () => this.prisma.dealRequest.count({ where }));
        const contacts = await this.contactsFor(page.items);
        return {
            ...page,
            items: page.items.map((r) => this.mapper.agency(r, contacts.get(r.id) ?? null)),
        };
    }
    async get(user, id, now = new Date()) {
        const actor = await this.actors.resolve(user);
        const row = await this.prisma.dealRequest.findFirst({
            where: { AND: [(0, deal_request_access_1.agencyVisibleWhere)(actor, now), { id }] },
            select: (0, deal_request_selects_1.dealRequestAgencySelect)(actor.agencyId),
        });
        if (!row)
            throw app_exception_1.AppException.notFound(shared_1.ErrorCode.DEAL_REQUEST_NOT_FOUND);
        const contacts = await this.contactsFor([row]);
        return this.mapper.agency(row, contacts.get(row.id) ?? null);
    }
    /**
     * Request part of the console dashboard: NEW requests (OPEN, not proposed to yet) by type, and
     * the latest visible requests in the inbox shape (same rows as the first inbox page).
     */
    async dashboardFor(actor, take, now = new Date()) {
        const fresh = (0, deal_request_access_1.agencyInboxWhere)(actor, { scope: shared_1.AgencyInboxScope.NEW }, now);
        const [byType, rows] = await Promise.all([
            this.prisma.dealRequest.groupBy({ by: ['type'], where: fresh, _count: { _all: true } }),
            this.prisma.dealRequest.findMany({
                where: (0, deal_request_access_1.agencyVisibleWhere)(actor, now),
                select: (0, deal_request_selects_1.dealRequestAgencySelect)(actor.agencyId),
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take,
            }),
        ]);
        const countOf = (type) => byType.find((g) => g.type === type)?._count._all ?? 0;
        const newSellCount = countOf(shared_1.DealRequestType.SELL_OR_LEASE);
        const newWantedCount = countOf(shared_1.DealRequestType.WANTED);
        const contacts = await this.contactsFor(rows);
        return {
            newCount: newSellCount + newWantedCount,
            newSellCount,
            newWantedCount,
            items: rows.map((r) => this.mapper.agency(r, contacts.get(r.id) ?? null)),
        };
    }
    /**
     * Contact of granted requests whose requester is still ACTIVE: a suspended or withdrawn member's
     * contact is never revealed, even before the scrub job runs.
     */
    async contactsFor(rows) {
        const ids = rows.filter(deal_request_mapper_1.canSeeContact).map((r) => r.id);
        if (ids.length === 0)
            return new Map();
        const contacts = await this.prisma.dealRequest.findMany({
            where: { id: { in: ids }, contactScrubbedAt: null, user: { status: shared_1.UserStatus.ACTIVE } },
            select: deal_request_selects_1.dealRequestContactSelect,
        });
        return new Map(contacts.map((c) => [c.id, c]));
    }
};
exports.AgencyInboxService = AgencyInboxService;
exports.AgencyInboxService = AgencyInboxService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        deal_request_mapper_1.DealRequestMapper,
        agency_actor_service_1.AgencyActorService])
], AgencyInboxService);
//# sourceMappingURL=agency-inbox.service.js.map