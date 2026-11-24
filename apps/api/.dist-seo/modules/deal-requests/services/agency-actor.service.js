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
exports.AgencyActorService = void 0;
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../../../common/errors/app.exception");
const agencies_service_1 = require("../../agencies/services/agencies.service");
const agency_directory_port_1 = require("../ports/agency-directory.port");
/**
 * Resolves the agency a broker acts for: the session's agency, an ACTIVE membership in it and an
 * APPROVED agency (403 otherwise, via AgenciesService), plus the agency's 시군구 for visibility.
 */
let AgencyActorService = class AgencyActorService {
    constructor(agencies, directory) {
        this.agencies = agencies;
        this.directory = directory;
    }
    async resolve(user) {
        const member = await this.agencies.assertActiveMember(user.userId, user.agencyId);
        const sggCode = await this.directory.approvedSggCode(member.agencyId);
        if (!sggCode)
            throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AGENCY_NOT_APPROVED);
        return { agencyId: member.agencyId, memberId: member.memberId, userId: user.userId, sggCode };
    }
};
exports.AgencyActorService = AgencyActorService;
exports.AgencyActorService = AgencyActorService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(agency_directory_port_1.DEAL_REQUEST_AGENCIES)),
    __metadata("design:paramtypes", [agencies_service_1.AgenciesService, Object])
], AgencyActorService);
//# sourceMappingURL=agency-actor.service.js.map