import {
  UserRole,
  type AgencyDocumentView,
  type AgencyInviteView,
  type AgencyMemberView,
  type MyAgency,
  type MyAgencyMembership,
  type Paginated,
} from '@house/shared';
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
import { Throttle } from '@nestjs/throttler';
import type { UserPrincipal } from '../../../common/auth/principal';
import { CurrentUser, Roles } from '../../../common/decorators';
import { THROTTLE } from '../../../common/throttle/throttle.constants';
import {
  AgencyDocumentDto,
  AgencyDocumentParamDto,
  AgencyInviteCreateDto,
  AgencyInviteParamDto,
  AgencyJoinDto,
  AgencyMemberListQueryDto,
  AgencyMemberParamDto,
  AgencyMemberUpdateDto,
  AgencyRegisterDto,
  AgencyResubmitDto,
  AgencyUpdateDto,
} from '../dto';
import { AgencyMembersService } from '../services/agency-members.service';
import { AgencyRegistrationService } from '../services/agency-registration.service';

/**
 * The logged-in user's own agency: 등록 신청, profile, documents, staff and invites, joining by
 * code. Registered before the public controller so `/agencies/mine` never hits `/agencies/:id`.
 * Ownership is resolved from the user id in the services (no agency id in these URLs).
 */
@ApiTags('agencies')
@Controller('agencies')
export class MyAgencyController {
  constructor(
    private readonly registration: AgencyRegistrationService,
    private readonly members: AgencyMembersService,
  ) {}

  @Post()
  @Throttle(THROTTLE.WRITE)
  register(@CurrentUser() user: UserPrincipal, @Body() dto: AgencyRegisterDto): Promise<MyAgency> {
    return this.registration.register(user, dto);
  }

  @Get('mine')
  getMine(@CurrentUser() user: UserPrincipal): Promise<MyAgency> {
    return this.registration.getMine(user);
  }

  @Patch('mine')
  @Throttle(THROTTLE.WRITE)
  updateMine(@CurrentUser() user: UserPrincipal, @Body() dto: AgencyUpdateDto): Promise<MyAgency> {
    return this.registration.updateMine(user, dto);
  }

  @Post('mine/resubmit')
  @HttpCode(HttpStatus.OK)
  @Throttle(THROTTLE.WRITE)
  resubmit(@CurrentUser() user: UserPrincipal, @Body() dto: AgencyResubmitDto): Promise<MyAgency> {
    return this.registration.resubmit(user, dto);
  }

  @Get('mine/documents')
  listDocuments(@CurrentUser() user: UserPrincipal): Promise<AgencyDocumentView[]> {
    return this.registration.listDocuments(user);
  }

  @Post('mine/documents')
  @Throttle(THROTTLE.WRITE)
  addDocument(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: AgencyDocumentDto,
  ): Promise<AgencyDocumentView> {
    return this.registration.addDocument(user, dto);
  }

  @Delete('mine/documents/:docId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDocument(
    @CurrentUser() user: UserPrincipal,
    @Param() p: AgencyDocumentParamDto,
  ): Promise<void> {
    return this.registration.removeDocument(user, p.docId);
  }

  // ---------- staff (owner of an APPROVED agency) ----------

  @Get('mine/members')
  @Roles(UserRole.AGENCY_OWNER)
  listMembers(
    @CurrentUser() user: UserPrincipal,
    @Query() q: AgencyMemberListQueryDto,
  ): Promise<Paginated<AgencyMemberView>> {
    return this.members.list(user, q);
  }

  @Patch('mine/members/:memberId')
  @Roles(UserRole.AGENCY_OWNER)
  updateMember(
    @CurrentUser() user: UserPrincipal,
    @Param() p: AgencyMemberParamDto,
    @Body() dto: AgencyMemberUpdateDto,
  ): Promise<AgencyMemberView> {
    return this.members.update(user, p.memberId, dto);
  }

  @Delete('mine/members/:memberId')
  @Roles(UserRole.AGENCY_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: UserPrincipal,
    @Param() p: AgencyMemberParamDto,
  ): Promise<void> {
    return this.members.remove(user, p.memberId);
  }

  @Get('mine/invites')
  @Roles(UserRole.AGENCY_OWNER)
  listInvites(@CurrentUser() user: UserPrincipal): Promise<AgencyInviteView[]> {
    return this.members.listInvites(user);
  }

  @Post('mine/invites')
  @Roles(UserRole.AGENCY_OWNER)
  @Throttle(THROTTLE.WRITE)
  createInvite(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: AgencyInviteCreateDto,
  ): Promise<AgencyInviteView> {
    return this.members.createInvite(user, dto);
  }

  @Delete('mine/invites/:inviteId')
  @Roles(UserRole.AGENCY_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  revokeInvite(
    @CurrentUser() user: UserPrincipal,
    @Param() p: AgencyInviteParamDto,
  ): Promise<void> {
    return this.members.revokeInvite(user, p.inviteId);
  }

  // ---------- membership of the caller ----------

  /** Redeem an invite code (brute force is limited by the AUTH throttle). */
  @Post('join')
  @Throttle(THROTTLE.AUTH)
  join(
    @CurrentUser() user: UserPrincipal,
    @Body() dto: AgencyJoinDto,
  ): Promise<MyAgencyMembership> {
    return this.members.join(user, dto);
  }

  @Get('membership')
  membership(@CurrentUser() user: UserPrincipal): Promise<MyAgencyMembership> {
    return this.members.myMembership(user);
  }

  @Post('membership/leave')
  @HttpCode(HttpStatus.NO_CONTENT)
  leave(@CurrentUser() user: UserPrincipal): Promise<void> {
    return this.members.leave(user);
  }
}
