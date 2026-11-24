"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirePermission = void 0;
const shared_1 = require("@house/shared");
const decorators_1 = require("../../common/decorators");
/**
 * Admin route that needs `permission` (see ADMIN_ROLE_PERMISSIONS in @house/shared). Expands to
 * @Roles(...admin roles holding it), so the global AuthGuard answers 401/403 as usual.
 * A handler-level decorator overrides the controller-level one.
 */
const RequirePermission = (permission) => (0, decorators_1.Roles)(...(0, shared_1.adminRolesWith)(permission));
exports.RequirePermission = RequirePermission;
//# sourceMappingURL=permissions.decorator.js.map