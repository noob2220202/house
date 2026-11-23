import { ErrorCode } from '@house/shared';
import { Inject, Injectable } from '@nestjs/common';
import type { UserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { AgenciesService } from '../../agencies/services/agencies.service';
import {
  DEAL_REQUEST_AGENCIES,
  type DealRequestAgencyDirectory,
} from '../ports/agency-directory.port';
import type { AgencyScope } from './deal-request-access';

export interface AgencyActor extends AgencyScope {
  memberId: string;
  userId: string;
}

/**
 * Resolves the agency a broker acts for: the session's agency, an ACTIVE membership in it and an
 * APPROVED agency (403 otherwise, via AgenciesService), plus the agency's 시군구 for visibility.
 */
@Injectable()
export class AgencyActorService {
  constructor(
    private readonly agencies: AgenciesService,
    @Inject(DEAL_REQUEST_AGENCIES) private readonly directory: DealRequestAgencyDirectory,
  ) {}

  async resolve(user: UserPrincipal): Promise<AgencyActor> {
    const member = await this.agencies.assertActiveMember(user.userId, user.agencyId);
    const sggCode = await this.directory.approvedSggCode(member.agencyId);
    if (!sggCode) throw AppException.forbidden(ErrorCode.AGENCY_NOT_APPROVED);
    return { agencyId: member.agencyId, memberId: member.memberId, userId: user.userId, sggCode };
  }
}
