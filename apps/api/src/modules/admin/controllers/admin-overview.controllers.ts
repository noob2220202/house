import {
  ADMIN_ROLE_PERMISSIONS,
  AdminPermission,
  type AdminDashboard,
  type AdminPermissionsResponse,
  type AuditLogView,
  type Paginated,
} from '@house/shared';
import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AdminOnly, CurrentAdmin } from '../../../common/decorators';
import { AuditLogQueryDto, IdParamDto } from '../dto';
import { RequirePermission } from '../permissions.decorator';
import { AuditLogsService } from '../services/audit-logs.service';
import { DashboardService } from '../services/dashboard.service';

/** What the signed-in admin may do (drives the back-office menu). */
@ApiTags('admin')
@AdminOnly()
@Controller('admin/permissions')
export class AdminPermissionsController {
  @Get()
  get(@CurrentAdmin() admin: AdminPrincipal): AdminPermissionsResponse {
    return {
      adminId: admin.adminId,
      role: admin.role,
      permissions: [...ADMIN_ROLE_PERMISSIONS[admin.role]],
    };
  }
}

@ApiTags('admin')
@RequirePermission(AdminPermission.DASHBOARD_READ)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  get(): Promise<AdminDashboard> {
    return this.dashboard.get();
  }
}

@ApiTags('admin/audit-logs')
@RequirePermission(AdminPermission.AUDIT_READ)
@Controller('admin/audit-logs')
export class AdminAuditLogsController {
  constructor(private readonly logs: AuditLogsService) {}

  @Get()
  list(@Query() q: AuditLogQueryDto): Promise<Paginated<AuditLogView>> {
    return this.logs.list(q);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<AuditLogView> {
    return this.logs.detail(p.id);
  }
}
