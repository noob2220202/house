import type { Paginated } from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AdminOnly, Audit, CurrentAdmin } from '../../../common/decorators';
import type { AdminDealRequestModerationView } from '../deal-request.mapper';
import {
  AdminDealRequestCloseDto,
  AdminDealRequestListQueryDto,
  AdminDealRequestSpamFlagDto,
  IdParamDto,
} from '../dto';
import { AdminDealRequestsService } from '../services/admin-deal-requests.service';

/** Back-office moderation of 내놓기/구하기 (/api/v1/admin/deal-requests). */
@ApiTags('admin/deal-requests')
@AdminOnly()
@Controller('admin/deal-requests')
export class AdminDealRequestsController {
  constructor(private readonly admin: AdminDealRequestsService) {}

  @Get()
  list(
    @Query() q: AdminDealRequestListQueryDto,
  ): Promise<Paginated<AdminDealRequestModerationView>> {
    return this.admin.list(q);
  }

  @Get(':id')
  get(@Param() p: IdParamDto): Promise<AdminDealRequestModerationView> {
    return this.admin.get(p.id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'dealRequest.close', resourceType: 'DealRequest' })
  close(
    @Param() p: IdParamDto,
    @Body() dto: AdminDealRequestCloseDto,
  ): Promise<AdminDealRequestModerationView> {
    return this.admin.close(p.id, dto);
  }

  /**
   * Spam flag `{ flagged, reason? }` (reason ≥ 5 chars when flagging). A flagged request is hidden
   * from every agency until the flag is cleared.
   */
  @Post(':id/spam-flag')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'dealRequest.spamFlag', resourceType: 'DealRequest' })
  spamFlag(
    @Param() p: IdParamDto,
    @Body() dto: AdminDealRequestSpamFlagDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminDealRequestModerationView> {
    return this.admin.setSpamFlag(p.id, dto, admin.adminId);
  }
}
