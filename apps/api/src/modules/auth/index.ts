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
export { PasswordService } from './admin/password.service';
export { SessionService } from './session/session.service';
export type { SessionKind, SessionPatch, SessionRecord } from './session/session.types';
export { SkipTermsCheck } from './terms/skip-terms-check.decorator';
export { TermsService } from './terms/terms.service';
export { UserSessionService } from './users/user-session.service';
export type { ActiveMembership } from './users/user-session.service';
export { PiiScrubService } from './jobs/pii-scrub.service';
