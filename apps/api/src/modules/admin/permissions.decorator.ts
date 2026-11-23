import { adminRolesWith, type AdminPermission } from '@house/shared';
import { Roles } from '../../common/decorators';

/**
 * Admin route that needs `permission` (see ADMIN_ROLE_PERMISSIONS in @house/shared). Expands to
 * @Roles(...admin roles holding it), so the global AuthGuard answers 401/403 as usual.
 * A handler-level decorator overrides the controller-level one.
 */
export const RequirePermission = (permission: AdminPermission): MethodDecorator & ClassDecorator =>
  Roles(...adminRolesWith(permission));
