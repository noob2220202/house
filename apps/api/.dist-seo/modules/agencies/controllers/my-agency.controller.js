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
exports.MyAgencyController = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const decorators_1 = require("../../../common/decorators");
const throttle_constants_1 = require("../../../common/throttle/throttle.constants");
const dto_1 = require("../dto");
const agency_members_service_1 = require("../services/agency-members.service");
const agency_registration_service_1 = require("../services/agency-registration.service");
/**
 * The logged-in user's own agency: 등록 신청, profile, documents, staff and invites, joining by
 * code. Registered before the public controller so `/agencies/mine` never hits `/agencies/:id`.
 * Ownership is resolved from the user id in the services (no agency id in these URLs).
 */
let MyAgencyController = class MyAgencyController {
    constructor(registration, members) {
        this.registration = registration;
        this.members = members;
    }
    register(user, dto) {
        return this.registration.register(user, dto);
    }
    /** Owner: full view (`myRole: OWNER`); staff: reduced view (`myRole: AGENT`), see the README. */
    getMine(user) {
        return this.registration.getMine(user);
    }
    updateMine(user, dto) {
        return this.registration.updateMine(user, dto);
    }
    resubmit(user, dto) {
        return this.registration.resubmit(user, dto);
    }
    listDocuments(user) {
        return this.registration.listDocuments(user);
    }
    addDocument(user, dto) {
        return this.registration.addDocument(user, dto);
    }
    removeDocument(user, p) {
        return this.registration.removeDocument(user, p.docId);
    }
    // ---------- staff (owner of an APPROVED agency) ----------
    listMembers(user, q) {
        return this.members.list(user, q);
    }
    updateMember(user, p, dto) {
        return this.members.update(user, p.memberId, dto);
    }
    removeMember(user, p) {
        return this.members.remove(user, p.memberId);
    }
    listInvites(user) {
        return this.members.listInvites(user);
    }
    createInvite(user, dto) {
        return this.members.createInvite(user, dto);
    }
    revokeInvite(user, p) {
        return this.members.revokeInvite(user, p.inviteId);
    }
    // ---------- membership of the caller ----------
    /** Redeem an invite code (brute force is limited by the AUTH throttle). */
    join(user, dto) {
        return this.members.join(user, dto);
    }
    membership(user) {
        return this.members.myMembership(user);
    }
    leave(user) {
        return this.members.leave(user);
    }
};
exports.MyAgencyController = MyAgencyController;
__decorate([
    (0, common_1.Post)(),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyRegisterDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "register", null);
__decorate([
    (0, common_1.Get)('mine'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "getMine", null);
__decorate([
    (0, common_1.Patch)('mine'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyUpdateDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "updateMine", null);
__decorate([
    (0, common_1.Post)('mine/resubmit'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyResubmitDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "resubmit", null);
__decorate([
    (0, common_1.Get)('mine/documents'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "listDocuments", null);
__decorate([
    (0, common_1.Post)('mine/documents'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyDocumentDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "addDocument", null);
__decorate([
    (0, common_1.Delete)('mine/documents/:docId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyDocumentParamDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "removeDocument", null);
__decorate([
    (0, common_1.Get)('mine/members'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyMemberListQueryDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "listMembers", null);
__decorate([
    (0, common_1.Patch)('mine/members/:memberId'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyMemberParamDto,
        dto_1.AgencyMemberUpdateDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "updateMember", null);
__decorate([
    (0, common_1.Delete)('mine/members/:memberId'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyMemberParamDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "removeMember", null);
__decorate([
    (0, common_1.Get)('mine/invites'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "listInvites", null);
__decorate([
    (0, common_1.Post)('mine/invites'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.WRITE),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyInviteCreateDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "createInvite", null);
__decorate([
    (0, common_1.Delete)('mine/invites/:inviteId'),
    (0, decorators_1.Roles)(shared_1.UserRole.AGENCY_OWNER),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Param)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyInviteParamDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "revokeInvite", null);
__decorate([
    (0, common_1.Post)('join'),
    (0, throttler_1.Throttle)(throttle_constants_1.THROTTLE.AUTH),
    __param(0, (0, decorators_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, dto_1.AgencyJoinDto]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "join", null);
__decorate([
    (0, common_1.Get)('membership'),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "membership", null);
__decorate([
    (0, common_1.Post)('membership/leave'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, decorators_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MyAgencyController.prototype, "leave", null);
exports.MyAgencyController = MyAgencyController = __decorate([
    (0, swagger_1.ApiTags)('agencies'),
    (0, common_1.Controller)('agencies'),
    __metadata("design:paramtypes", [agency_registration_service_1.AgencyRegistrationService,
        agency_members_service_1.AgencyMembersService])
], MyAgencyController);
//# sourceMappingURL=my-agency.controller.js.map