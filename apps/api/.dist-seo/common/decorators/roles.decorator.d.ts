import { AdminRole, Role } from '@house/shared';
/** Allow only principals whose role is in `roles`. */
export declare const Roles: (...roles: Role[]) => MethodDecorator & ClassDecorator;
/** Admin-only route; `min` sets the lowest admin role allowed (default OPERATOR). */
export declare const AdminOnly: (min?: AdminRole) => MethodDecorator & ClassDecorator;
