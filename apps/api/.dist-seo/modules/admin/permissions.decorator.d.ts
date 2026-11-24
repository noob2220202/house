import { type AdminPermission } from '@house/shared';
/**
 * Admin route that needs `permission` (see ADMIN_ROLE_PERMISSIONS in @house/shared). Expands to
 * @Roles(...admin roles holding it), so the global AuthGuard answers 401/403 as usual.
 * A handler-level decorator overrides the controller-level one.
 */
export declare const RequirePermission: (permission: AdminPermission) => MethodDecorator & ClassDecorator;
