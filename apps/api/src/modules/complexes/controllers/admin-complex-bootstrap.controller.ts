import type { ComplexBootstrapAccepted, ComplexBootstrapJobView } from '@house/shared';
import { AdminRole, ErrorCode } from '@house/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuditService } from '../../../common/audit/audit.service';
import { AdminOnly } from '../../../common/decorators';
import { AppException } from '../../../common/errors/app.exception';
import { ComplexBootstrapJobs } from '../bootstrap/complex-bootstrap.jobs';
import { ComplexBootstrapJobParamDto, ComplexBootstrapRequestDto } from '../dto';

/**
 * 단지 자동 생성 from 실거래가. The run is a job on the trade-sync queue (minutes: every month of
 * the period × 2 APIs, then geocoding): POST answers 202 with the job id; the admin polls
 * GET :jobId (progress, preview once planned, result). `dryRun` (default) writes nothing.
 * Starting a run needs ADMIN (it creates 단지 and re-syncs 실거래가); reading OPERATOR.
 */
@ApiTags('complexes')
@Controller('admin/complexes/bootstrap')
export class AdminComplexBootstrapController {
  constructor(
    private readonly jobs: ComplexBootstrapJobs,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @AdminOnly(AdminRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  async start(@Body() dto: ComplexBootstrapRequestDto): Promise<ComplexBootstrapAccepted> {
    const accepted = await this.jobs.enqueue(dto);
    await this.audit.record({
      action: dto.dryRun ? 'complex.bootstrap.preview' : 'complex.bootstrap.run',
      resourceType: 'Complex',
      after: { months: dto.months, dryRun: dto.dryRun, jobId: accepted.jobId },
    });
    return accepted;
  }

  /** The latest run (any state), so the screen can pick it up after a reload. */
  @Get()
  @AdminOnly(AdminRole.OPERATOR)
  async latest(): Promise<{ item: ComplexBootstrapJobView | null }> {
    return { item: await this.jobs.latest() };
  }

  @Get(':jobId')
  @AdminOnly(AdminRole.OPERATOR)
  async get(@Param() p: ComplexBootstrapJobParamDto): Promise<ComplexBootstrapJobView> {
    const view = await this.jobs.get(p.jobId);
    if (!view) throw AppException.notFound(ErrorCode.COMPLEX_BOOTSTRAP_JOB_NOT_FOUND);
    return view;
  }
}
