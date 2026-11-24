import { UserRole } from '@house/shared';
import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser, Roles } from '../../../common/decorators';
import {
  ConsoleDashboardService,
  type AgencyConsoleDashboard,
} from '../services/console-dashboard.service';

/**
 * Broker console home (/api/v1/agencies/mine/dashboard): AGENT / AGENCY_OWNER acting for an
 * APPROVED agency with an ACTIVE membership (403 otherwise, as the inbox).
 */
@ApiTags('agencies')
@Roles(UserRole.AGENT, UserRole.AGENCY_OWNER)
@Controller('agencies/mine')
export class AgencyDashboardController {
  constructor(private readonly dashboard: ConsoleDashboardService) {}

  @Get('dashboard')
  get(@CurrentUser() user: UserPrincipal): Promise<AgencyConsoleDashboard> {
    return this.dashboard.get(user);
  }
}
