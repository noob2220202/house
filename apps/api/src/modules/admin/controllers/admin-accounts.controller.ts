import type { AdminAccountView, Paginated } from '@house/shared';
import { AdminPermission } from '@house/shared';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { Audit, CurrentAdmin } from '../../../common/decorators';
import {
  AdminAccountCreateDto,
  AdminAccountListQueryDto,
  AdminAccountUpdateDto,
  AdminPasswordResetDto,
  IdParamDto,
} from '../dto';
import { RequirePermission } from '../permissions.decorator';
import { AdminAccountsService } from '../services/admin-accounts.service';

/**
 * Back-office accounts (SUPER_ADMIN only). DELETE is a soft delete (the row stays DISABLED with a
 * released e-mail so audit history keeps its actor).
 */
@ApiTags('admin/admins')
@RequirePermission(AdminPermission.ADMINS_MANAGE)
@Controller('admin/admins')
export class AdminAccountsController {
  constructor(private readonly accounts: AdminAccountsService) {}

  @Get()
  list(@Query() q: AdminAccountListQueryDto): Promise<Paginated<AdminAccountView>> {
    return this.accounts.list(q);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<AdminAccountView> {
    return this.accounts.detail(p.id);
  }

  @Post()
  @Audit({ action: 'admin-account.create', resourceType: 'AdminUser' })
  create(@Body() dto: AdminAccountCreateDto): Promise<AdminAccountView> {
    return this.accounts.create(dto);
  }

  @Patch(':id')
  @Audit({ action: 'admin-account.update', resourceType: 'AdminUser' })
  update(
    @Param() p: IdParamDto,
    @Body() dto: AdminAccountUpdateDto,
    @CurrentAdmin() actor: AdminPrincipal,
  ): Promise<AdminAccountView> {
    return this.accounts.update(actor, p.id, dto);
  }

  @Post(':id/reset-password')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'admin-account.reset-password', resourceType: 'AdminUser' })
  resetPassword(
    @Param() p: IdParamDto,
    @Body() dto: AdminPasswordResetDto,
    @CurrentAdmin() actor: AdminPrincipal,
  ): Promise<AdminAccountView> {
    return this.accounts.resetPassword(actor, p.id, dto);
  }

  @Post(':id/reset-totp')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'admin-account.reset-totp', resourceType: 'AdminUser' })
  resetTotp(
    @Param() p: IdParamDto,
    @CurrentAdmin() actor: AdminPrincipal,
  ): Promise<AdminAccountView> {
    return this.accounts.resetTotp(actor, p.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'admin-account.delete', resourceType: 'AdminUser' })
  remove(@Param() p: IdParamDto, @CurrentAdmin() actor: AdminPrincipal): Promise<void> {
    return this.accounts.remove(actor, p.id);
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'admin-account.unlock', resourceType: 'AdminUser' })
  unlock(@Param() p: IdParamDto): Promise<AdminAccountView> {
    return this.accounts.unlock(p.id);
  }
}
