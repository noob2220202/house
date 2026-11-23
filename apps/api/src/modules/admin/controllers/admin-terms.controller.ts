import type { AdminTermsView, Paginated } from '@house/shared';
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
import { Audit } from '../../../common/decorators';
import {
  IdParamDto,
  TermsAdminListQueryDto,
  TermsInputDto,
  TermsPublishDto,
  TermsUpdateDto,
} from '../dto';
import { RequirePermission } from '../permissions.decorator';
import { AdminTermsService } from '../services/admin-terms.service';

/** 약관 versions: drafts are editable, published versions are immutable. */
@ApiTags('admin/terms')
@RequirePermission(AdminPermission.TERMS_MANAGE)
@Controller('admin/terms')
export class AdminTermsController {
  constructor(private readonly terms: AdminTermsService) {}

  @Get()
  list(@Query() q: TermsAdminListQueryDto): Promise<Paginated<AdminTermsView>> {
    return this.terms.list(q);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<AdminTermsView> {
    return this.terms.detail(p.id);
  }

  @Post()
  @Audit({ action: 'terms.create', resourceType: 'TermsDocument' })
  create(@Body() dto: TermsInputDto): Promise<AdminTermsView> {
    return this.terms.create(dto);
  }

  @Patch(':id')
  @Audit({ action: 'terms.update', resourceType: 'TermsDocument' })
  update(@Param() p: IdParamDto, @Body() dto: TermsUpdateDto): Promise<AdminTermsView> {
    return this.terms.update(p.id, dto);
  }

  /** Audited inside the publish transaction (records an `urgent` override and its reason). */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@Param() p: IdParamDto, @Body() dto: TermsPublishDto): Promise<AdminTermsView> {
    return this.terms.publish(p.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'terms.delete', resourceType: 'TermsDocument' })
  remove(@Param() p: IdParamDto): Promise<void> {
    return this.terms.remove(p.id);
  }
}
