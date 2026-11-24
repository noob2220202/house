"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CurrentAdmin = exports.CurrentUser = exports.CurrentPrincipal = void 0;
const common_1 = require("@nestjs/common");
const app_exception_1 = require("../errors/app.exception");
const principal_1 = require("../auth/principal");
/** The principal if any (use on @Public routes that personalize when logged in). */
exports.CurrentPrincipal = (0, common_1.createParamDecorator)((_, ctx) => ctx.switchToHttp().getRequest().principal);
/** The logged-in site user; throws 401 if the request has no user session. */
exports.CurrentUser = (0, common_1.createParamDecorator)((_, ctx) => {
    const p = ctx.switchToHttp().getRequest().principal;
    if (!(0, principal_1.isUserPrincipal)(p))
        throw app_exception_1.AppException.unauthenticated();
    return p;
});
/** The logged-in admin; throws 401 if the request has no admin session. */
exports.CurrentAdmin = (0, common_1.createParamDecorator)((_, ctx) => {
    const p = ctx.switchToHttp().getRequest().principal;
    if (!(0, principal_1.isAdminPrincipal)(p))
        throw app_exception_1.AppException.unauthenticated();
    return p;
});
//# sourceMappingURL=current-user.decorator.js.map