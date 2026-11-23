import type { ProposalView } from '@house/shared';
import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import { IdParamDto, ProposalAcceptDto } from '../dto';
import { ProposalsService } from '../services/proposals.service';

/** The requester answering proposals on their own requests (/api/v1/me/proposals). */
@ApiTags('deal-requests')
@Controller('me/proposals')
export class MyProposalsController {
  constructor(private readonly proposals: ProposalsService) {}

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.WRITE)
  accept(
    @CurrentUser() user: UserPrincipal,
    @Param() p: IdParamDto,
    @Body() dto: ProposalAcceptDto,
  ): Promise<ProposalView> {
    return this.proposals.accept(user, p.id, dto);
  }

  @Post(':id/decline')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.WRITE)
  decline(@CurrentUser() user: UserPrincipal, @Param() p: IdParamDto): Promise<ProposalView> {
    return this.proposals.decline(user, p.id);
  }
}
