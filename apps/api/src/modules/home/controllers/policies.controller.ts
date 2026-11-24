import { AdminPermission, adminRolesWith, type Paginated } from '@house/shared';
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
import { Audit, Public, Roles } from '../../../common/decorators';
import {
  IdParamDto,
  PolicyAdminListQueryDto,
  PolicyCreateDto,
  PolicySlugParamDto,
  PolicyUpdateDto,
} from '../dto';
import {
  PoliciesService,
  type AdminPolicyView,
  type PolicyDocumentView,
} from '../services/policies.service';

@ApiTags('home')
@Controller('policies')
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  /** The version in force of an operating policy page; 404 until one is published. */
  @Public()
  @Get(':slug')
  get(@Param() p: PolicySlugParamDto): Promise<PolicyDocumentView> {
    return this.policies.current(p.slug);
  }
}

/** 운영 정책 문서 versions (same permission as 약관): drafts editable, published immutable. */
@ApiTags('admin/policies')
@Roles(...adminRolesWith(AdminPermission.TERMS_MANAGE))
@Controller('admin/policies')
export class AdminPoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  list(@Query() q: PolicyAdminListQueryDto): Promise<Paginated<AdminPolicyView>> {
    return this.policies.list(q);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<AdminPolicyView> {
    return this.policies.detail(p.id);
  }

  @Post()
  @Audit({ action: 'policy.create', resourceType: 'PolicyDocument' })
  create(@Body() dto: PolicyCreateDto): Promise<AdminPolicyView> {
    return this.policies.create(dto);
  }

  @Patch(':id')
  @Audit({ action: 'policy.update', resourceType: 'PolicyDocument' })
  update(@Param() p: IdParamDto, @Body() dto: PolicyUpdateDto): Promise<AdminPolicyView> {
    return this.policies.update(p.id, dto);
  }

  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @Audit({ action: 'policy.publish', resourceType: 'PolicyDocument' })
  publish(@Param() p: IdParamDto): Promise<AdminPolicyView> {
    return this.policies.publish(p.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'policy.delete', resourceType: 'PolicyDocument' })
  remove(@Param() p: IdParamDto): Promise<void> {
    return this.policies.remove(p.id);
  }
}
