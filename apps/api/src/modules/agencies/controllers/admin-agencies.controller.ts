import { createReadStream } from 'node:fs';
import type {
  AdminAgencyDetail,
  AdminAgencyListItem,
  AgencyRegistryCheck,
  Paginated,
} from '@house/shared';
import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AdminPrincipal } from '../../../common/auth/principal';
import { AdminOnly, CurrentAdmin } from '../../../common/decorators';
import {
  AdminAgencyListQueryDto,
  AgencyAdminDocumentParamDto,
  AgencyDecisionDto,
  AgencyRegistryCheckQueryDto,
  IdParamDto,
} from '../dto';
import { AgencyReviewService } from '../services/agency-review.service';

/**
 * Back-office agency review (/api/v1/admin/agencies). The admin module links here from its
 * dashboard; approval logic lives in AgencyReviewService. Decisions are audited in-transaction.
 */
@ApiTags('admin/agencies')
@AdminOnly()
@Controller('admin/agencies')
export class AdminAgenciesController {
  constructor(private readonly review: AgencyReviewService) {}

  @Get()
  list(@Query() q: AdminAgencyListQueryDto): Promise<Paginated<AdminAgencyListItem>> {
    return this.review.list(q);
  }

  @Get(':id')
  detail(@Param() p: IdParamDto): Promise<AdminAgencyDetail> {
    return this.review.detail(p.id);
  }

  @Post(':id/decision')
  @HttpCode(HttpStatus.OK)
  decide(
    @Param() p: IdParamDto,
    @Body() dto: AgencyDecisionDto,
    @CurrentAdmin() admin: AdminPrincipal,
  ): Promise<AdminAgencyDetail> {
    return this.review.decide(p.id, dto, admin);
  }

  @Get(':id/registry-check')
  registryCheck(
    @Param() p: IdParamDto,
    @Query() q: AgencyRegistryCheckQueryDto,
  ): Promise<AgencyRegistryCheck> {
    return this.review.registryCheck(p.id, q.refresh);
  }

  /** Streams a private document (등록증 등). Never cached; every view is audited. */
  @Get(':id/documents/:docId/file')
  @Header('Cache-Control', 'private, no-store')
  async documentFile(@Param() p: AgencyAdminDocumentParamDto): Promise<StreamableFile> {
    const file = await this.review.documentFile(p.id, p.docId);
    return new StreamableFile(createReadStream(file.path), {
      type: file.mimeType,
      length: file.sizeBytes,
      disposition: `${file.inline ? 'inline' : 'attachment'}; filename="${file.filename}"`,
    });
  }
}
