import { Controller, Get, Param, Query } from '@nestjs/common';
import type { TermsDetail, TermsSummary } from '@house/shared';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../../../common/decorators/public.decorator';
import { TermsTypeParamDto, TermsVersionParamDto, TermsVersionQueryDto } from '../dto';
import { TermsService, type TermsVersionSummary } from './terms.service';

/** Published terms (이용약관, 개인정보처리방침, 위치기반서비스 이용약관, 마케팅 수신). */
@ApiTags('auth')
@Controller('terms')
@Public()
export class TermsController {
  constructor(private readonly terms: TermsService) {}

  @Get()
  list(): Promise<TermsSummary[]> {
    return this.terms.listCurrent();
  }

  /** Current version of a type (`service`, `privacy`, …), or `?version=` for a past one. */
  @Get(':type')
  get(@Param() params: TermsTypeParamDto, @Query() q: TermsVersionQueryDto): Promise<TermsDetail> {
    return this.terms.getByType(params.type, q.version);
  }

  /** Published versions of a type, newest first (no content); `isCurrent` = in force now. */
  @Get(':type/versions')
  versions(@Param() params: TermsTypeParamDto): Promise<TermsVersionSummary[]> {
    return this.terms.versions(params.type);
  }

  /** One published version (same as `GET /terms/:type?version=`). */
  @Get(':type/versions/:version')
  version(@Param() params: TermsVersionParamDto): Promise<TermsDetail> {
    return this.terms.getByType(params.type, params.version);
  }
}
