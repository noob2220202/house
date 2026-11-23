import type {
  AdminComplexListItem,
  AdminComplexView,
  ComplexAreaTypeView,
  ComplexPhotoView,
  Paginated,
} from '@house/shared';
import { AdminRole } from '@house/shared';
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
  Put,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AdminOnly, Audit } from '../../../common/decorators';
import {
  AdminComplexListQueryDto,
  AreaTypeParamDto,
  ComplexPhotosDto,
  CreateAreaTypeDto,
  CreateComplexDto,
  IdParamDto,
  UpdateAreaTypeDto,
  UpdateComplexDto,
} from '../dto';
import { ComplexAdminService } from '../services/complex-admin.service';

@ApiTags('complexes')
@Controller('admin/complexes')
@AdminOnly(AdminRole.OPERATOR)
export class AdminComplexesController {
  constructor(private readonly admin: ComplexAdminService) {}

  @Get()
  list(@Query() q: AdminComplexListQueryDto): Promise<Paginated<AdminComplexListItem>> {
    return this.admin.list(q);
  }

  @Get(':id')
  get(@Param() p: IdParamDto): Promise<AdminComplexView> {
    return this.admin.get(p.id);
  }

  @Post()
  @Audit({ action: 'complex.create', resourceType: 'Complex' })
  create(@Body() dto: CreateComplexDto): Promise<AdminComplexView> {
    return this.admin.create(dto);
  }

  @Patch(':id')
  @Audit({ action: 'complex.update', resourceType: 'Complex' })
  update(@Param() p: IdParamDto, @Body() dto: UpdateComplexDto): Promise<AdminComplexView> {
    return this.admin.update(p.id, dto);
  }

  @Delete(':id')
  @AdminOnly(AdminRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'complex.delete', resourceType: 'Complex' })
  remove(@Param() p: IdParamDto): Promise<void> {
    return this.admin.remove(p.id);
  }

  @Post(':id/area-types')
  @Audit({ action: 'complex.area-type.create', resourceType: 'ComplexAreaType', idParam: 'id' })
  addAreaType(
    @Param() p: IdParamDto,
    @Body() dto: CreateAreaTypeDto,
  ): Promise<ComplexAreaTypeView> {
    return this.admin.addAreaType(p.id, dto);
  }

  @Patch(':id/area-types/:areaTypeId')
  @Audit({
    action: 'complex.area-type.update',
    resourceType: 'ComplexAreaType',
    idParam: 'areaTypeId',
  })
  updateAreaType(
    @Param() p: AreaTypeParamDto,
    @Body() dto: UpdateAreaTypeDto,
  ): Promise<ComplexAreaTypeView> {
    return this.admin.updateAreaType(p.id, p.areaTypeId, dto);
  }

  @Delete(':id/area-types/:areaTypeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({
    action: 'complex.area-type.delete',
    resourceType: 'ComplexAreaType',
    idParam: 'areaTypeId',
  })
  removeAreaType(@Param() p: AreaTypeParamDto): Promise<void> {
    return this.admin.removeAreaType(p.id, p.areaTypeId);
  }

  /** Replaces the 단지 photo list; order = array order. */
  @Put(':id/photos')
  @Audit({ action: 'complex.photos.set', resourceType: 'Complex' })
  setPhotos(@Param() p: IdParamDto, @Body() dto: ComplexPhotosDto): Promise<ComplexPhotoView[]> {
    return this.admin.setPhotos(p.id, dto);
  }
}
