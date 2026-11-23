import type { AdminDealRequestView, Paginated } from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, Audit } from '../../../common/decorators';
import { AdminDealRequestCloseDto, AdminDealRequestListQueryDto, IdParamDto } from '../dto';
import { AdminDealRequestsService } from '../services/admin-deal-requests.service';

/** Back-office moderation of 내놓기/구하기 (/api/v1/admin/deal-requests). */
@ApiTags('admin/deal-requests')
@AdminOnly()
@Controller('admin/deal-requests')
export class AdminDealRequestsController {
  constructor(private readonly admin: AdminDealRequestsService) {}

  @Get()
  list(@Query() q: AdminDealRequestListQueryDto): Promise<Paginated<AdminDealRequestView>> {
    return this.admin.list(q);
  }

  @Get(':id')
  get(@Param() p: IdParamDto): Promise<AdminDealRequestView> {
    return this.admin.get(p.id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'dealRequest.close', resourceType: 'DealRequest' })
  close(
    @Param() p: IdParamDto,
    @Body() dto: AdminDealRequestCloseDto,
  ): Promise<AdminDealRequestView> {
    return this.admin.close(p.id, dto);
  }
}
