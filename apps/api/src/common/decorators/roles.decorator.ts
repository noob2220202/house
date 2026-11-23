import { SetMetadata } from '@nestjs/common';
import { ADMIN_ROLE_RANK, AdminRole, Role } from '@house/shared';
import { ROLES_KEY } from './metadata-keys';

/** Allow only principals whose role is in `roles`. */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

/** Admin-only route; `min` sets the lowest admin role allowed (default OPERATOR). */
export const AdminOnly = (min: AdminRole = AdminRole.OPERATOR): MethodDecorator & ClassDecorator =>
  Roles(
    ...(Object.keys(ADMIN_ROLE_RANK) as AdminRole[]).filter(
      (r) => ADMIN_ROLE_RANK[r] >= ADMIN_ROLE_RANK[min],
    ),
  );
