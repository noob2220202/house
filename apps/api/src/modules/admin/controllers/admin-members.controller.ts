import type { MemberDetail, MemberListItem, Paginated } from '@house/shared';
import { AdminPermission } from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IdParamDto, MemberListQueryDto, MemberSuspendDto } from '../dto';
import { RequirePermission } from '../permissions.decorator';
import { MembersService } from '../services/members.service';

/**
 * Site members: search/detail for operators, suspension for ADMIN+. GET /:id shows unmasked
 * contacts and is logged as `member.pii-view`; suspension is audited inside its transaction.
 */
@ApiTags('admin/users')
@RequirePermission(AdminPermission.MEMBERS_READ)
@Controller('admin/users')
export class AdminMembersController {
  constructor(private readonly members: MembersService) {}

  @Get()
  list(@Query() q: MemberListQueryDto): Promise<Paginated<MemberListItem>> {
    return this.members.list(q);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<MemberDetail> {
    return this.members.detail(p.id);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(AdminPermission.MEMBERS_SUSPEND)
  suspend(@Param() p: IdParamDto, @Body() dto: MemberSuspendDto): Promise<MemberDetail> {
    return this.members.suspend(p.id, dto);
  }

  @Post(':id/unsuspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermission(AdminPermission.MEMBERS_SUSPEND)
  unsuspend(@Param() p: IdParamDto): Promise<MemberDetail> {
    return this.members.unsuspend(p.id);
  }
}
