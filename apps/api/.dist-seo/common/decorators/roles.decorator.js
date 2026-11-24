"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminOnly = exports.Roles = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const metadata_keys_1 = require("./metadata-keys");
/** Allow only principals whose role is in `roles`. */
const Roles = (...roles) => (0, common_1.SetMetadata)(metadata_keys_1.ROLES_KEY, roles);
exports.Roles = Roles;
/** Admin-only route; `min` sets the lowest admin role allowed (default OPERATOR). */
const AdminOnly = (min = shared_1.AdminRole.OPERATOR) => (0, exports.Roles)(...Object.keys(shared_1.ADMIN_ROLE_RANK).filter((r) => shared_1.ADMIN_ROLE_RANK[r] >= shared_1.ADMIN_ROLE_RANK[min]));
exports.AdminOnly = AdminOnly;
//# sourceMappingURL=roles.decorator.js.map