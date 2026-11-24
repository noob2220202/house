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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencyDealRequestsController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("../../../common/decorators");
const throttle_constants_1 = require("../../../common/throttle/throttle.constants");
const dto_1 = require("../dto");
const agency_inbox_service_1 = require("../services/agency-inbox.service");
const listing_candidates_service_1 = require("../services/listing-candidates.service");
const proposals_service_1 = require("../services/proposals.service");
/**
 * Broker side (/api/v1/agency/...): the inbox of requests visible to the session's agency and the
 * agency's proposals. Membership + approval are checked per request (AgencyActorService).
 */
let AgencyDealRequestsController = class AgencyDealRequestsController {
    constructor(inbox, proposals, candidates) {
        this.inbox = inbox;
        this.proposals = proposals;
        this.candidates = candidates;
    }
    list(user, q) {
        return this.inbox.list(user, q);
    }
    get(user, p) {
        return this.inbox.get(user, p.id);
    }
    /** The agency's ACTIVE listings for the proposal picker, best match for the request first. */
    listingCandidates(user, p, q) {
        return this.candidates.list(user, p.id, q);
    }
    propose(user, p, dto) {
        return this.proposals.create(user, p.id, dto);
    }
    listProposals(user, q) {
        return this.proposals.listForAgency(user, q);
    }
    withdraw(user, p) {
        return this.proposals.withdraw(user, p.id);
    }
};
exports.AgencyDealRequestsController = AgencyDealRequestsController;
__decorate([
    (0, common_1.Get)('deal-requests'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyDealRequestListQueryDto]),
    __metadata("design:returntype", Promise)
], AgencyDealRequestsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('deal-requests/:id'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AgencyDealRequestsController.prototype, "get", null);
__decorate([
    (0, common_1.Get)('deal-requests/:id/listing-candidates'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto,
        dto_1.ListingCandidateQueryDto]),
    __metadata("design:returntype", Promise)
], AgencyDealRequestsController.prototype, "listingCandidates", null);
__decorate([
    (0, common_1.Post)('deal-requests/:id/proposals'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto,
        dto_1.ProposalCreateDto]),
    __metadata("design:returntype", Promise)
], AgencyDealRequestsController.prototype, "propose", null);
__decorate([
    (0, common_1.Get)('proposals'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyProposalListQueryDto]),
    __metadata("design:returntype", Promise)
], AgencyDealRequestsController.prototype, "listProposals", null);
__decorate([
    (0, common_1.Post)('proposals/:id/withdraw'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.IdParamDto]),
    __metadata("design:returntype", Promise)
], AgencyDealRequestsController.prototype, "withdraw", null);
exports.AgencyDealRequestsController = AgencyDealRequestsController = __decorate([
    (0, swagger_1.ApiTags)('deal-requests'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENT, shared_1.UserRole.AGENCY_OWNER),
    (0, common_1.Controller)('agency'),
    __metadata("design:paramtypes", [agency_inbox_service_1.AgencyInboxService,
        proposals_service_1.ProposalsService,
        listing_candidates_service_1.ListingCandidatesService])
], AgencyDealRequestsController);
//# sourceMappingURL=agency-deal-requests.controller.js.map