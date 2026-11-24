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
var AgencySessionSyncService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencySessionSyncService = void 0;
const common_1 = require("@nestjs/common");
const auth_1 = require("../../auth");
/**
 * Keeps live Redis sessions in step with agency membership changes (role / acting agency), so the
 * user does not have to log in again after approval, joining or removal. Failures are logged and
 * never fail the request: the next login recomputes both from the database anyway.
 */
let AgencySessionSyncService = AgencySessionSyncService_1 = class AgencySessionSyncService {
    constructor(sessions) {
        this.sessions = sessions;
        this.logger = new common_1.Logger(AgencySessionSyncService_1.name);
    }
    async apply(userId, patch) {
        try {
            await this.sessions.updateAllForSubject('USER', userId, patch);
        }
        catch (err) {
            this.logger.warn({ err, userId }, 'failed to update sessions after agency change');
        }
    }
};
exports.AgencySessionSyncService = AgencySessionSyncService;
exports.AgencySessionSyncService = AgencySessionSyncService = AgencySessionSyncService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_1.SessionService])
], AgencySessionSyncService);
//# sourceMappingURL=agency-session-sync.service.js.map