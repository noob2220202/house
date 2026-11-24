"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PiiScrubService = exports.UserSessionService = exports.TermsService = exports.SkipTermsCheck = exports.SessionService = exports.PasswordService = void 0;
/**
 * Public surface of the auth module for other modules. Guards/decorators/ownership helpers live in
 * common/ (`AuthGuard`, `@Public`, `@Roles`, `@AdminOnly`, `@CurrentUser`, `@CurrentAdmin`,
 * `assertOwnedBy`, `assertActsForAgency`); these are the auth services you may inject.
 *
 *  - SessionService.destroyAllForSubject('USER', userId)        → force logout (suspension)
 *  - SessionService.updateAllForSubject('USER', userId, patch)  → role / agencyId changed
 *  - UserSessionService.activeMembership(userId)                → agency a session should act for
 *  - PasswordService.hash(password)                             → create / reset admin accounts
 *  - TermsService.current()                                     → current terms documents
 *
 * TermsConsentGuard (global) refuses state-changing member requests with 403 AUTH_TERMS_REQUIRED
 * while a current required terms version is not agreed; `@SkipTermsCheck()` exempts a route that
 * must stay usable then (auth, own account, consents, withdrawal). Use it sparingly.
 */
var password_service_1 = require("./admin/password.service");
Object.defineProperty(exports, "PasswordService", { enumerable: true, get: function () { return password_service_1.PasswordService; } });
var session_service_1 = require("./session/session.service");
Object.defineProperty(exports, "SessionService", { enumerable: true, get: function () { return session_service_1.SessionService; } });
var skip_terms_check_decorator_1 = require("./terms/skip-terms-check.decorator");
Object.defineProperty(exports, "SkipTermsCheck", { enumerable: true, get: function () { return skip_terms_check_decorator_1.SkipTermsCheck; } });
var terms_service_1 = require("./terms/terms.service");
Object.defineProperty(exports, "TermsService", { enumerable: true, get: function () { return terms_service_1.TermsService; } });
var user_session_service_1 = require("./users/user-session.service");
Object.defineProperty(exports, "UserSessionService", { enumerable: true, get: function () { return user_session_service_1.UserSessionService; } });
var pii_scrub_service_1 = require("./jobs/pii-scrub.service");
Object.defineProperty(exports, "PiiScrubService", { enumerable: true, get: function () { return pii_scrub_service_1.PiiScrubService; } });
//# sourceMappingURL=index.js.map