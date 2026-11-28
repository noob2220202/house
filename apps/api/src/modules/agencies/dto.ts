import {
  ACTION_CONSENT_TERMS,
  actionConsentsSchema,
  adminAgencyListQuerySchema,
  agencyAdminDocumentParamSchema,
  agencyAdminDeleteSchema,
  agencyDecisionSchema,
  adminAgencyDetailQuerySchema,
  agencyDocumentInputSchema,
  agencyDocumentParamSchema,
  agencyInviteCreateSchema,
  agencyInviteParamSchema,
  agencyJoinSchema,
  agencyLocationUpdateSchema,
  agencyMapQuerySchema,
  agencyMemberListQuerySchema,
  agencyMemberParamSchema,
  agencyMemberUpdateSchema,
  agencyRegisterSchema,
  agencyRegistryCheckQuerySchema,
  agencyResubmitSchema,
  agencySearchQuerySchema,
  agencyUpdateSchema,
  adminAgencySiteDecisionSchema,
  adminAgencySiteListQuerySchema,
  adminSubscriptionCreateSchema,
  adminSubscriptionUpdateSchema,
  agencySiteAvailabilityQuerySchema,
  agencySiteRequestSchema,
  agencySiteUpdateSchema,
  idParamSchema,
  siteSlugSchema,
} from '@house/shared';
import { z } from 'zod';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';

export class IdParamDto extends createZodDto(idParamSchema) {}
export class AgencyRegisterDto extends createZodDto(agencyRegisterSchema) {}
/**
 * Resubmission body: the shared schema plus optional D8 `consents` (local until the shared schema
 * has them). Sent → the current 개인정보 수집·이용 동의 version is required and recorded; omitted →
 * the application's consent still covers the resubmission.
 */
export const agencyResubmitWithConsentsSchema = agencyResubmitSchema.safeExtend({
  consents: actionConsentsSchema(ACTION_CONSENT_TERMS.AGENCY_APPLICATION),
});
export class AgencyResubmitDto extends createZodDto(agencyResubmitWithConsentsSchema) {}
export class AgencyUpdateDto extends createZodDto(agencyUpdateSchema) {}
export class AgencySearchQueryDto extends createZodDto(agencySearchQuerySchema) {}
export class AgencyMapQueryDto extends createZodDto(agencyMapQuerySchema) {}
export class AgencyDocumentDto extends createZodDto(agencyDocumentInputSchema) {}
export class AgencyDocumentParamDto extends createZodDto(agencyDocumentParamSchema) {}
export class AgencyAdminDocumentParamDto extends createZodDto(agencyAdminDocumentParamSchema) {}
export class AgencyMemberParamDto extends createZodDto(agencyMemberParamSchema) {}
export class AgencyMemberListQueryDto extends createZodDto(agencyMemberListQuerySchema) {}
export class AgencyMemberUpdateDto extends createZodDto(agencyMemberUpdateSchema) {}
export class AgencyInviteCreateDto extends createZodDto(agencyInviteCreateSchema) {}
export class AgencyInviteParamDto extends createZodDto(agencyInviteParamSchema) {}
export class AgencyJoinDto extends createZodDto(agencyJoinSchema) {}
export class AdminAgencyListQueryDto extends createZodDto(adminAgencyListQuerySchema) {}
export class AgencyDecisionDto extends createZodDto(agencyDecisionSchema) {}
export class AgencyAdminDeleteDto extends createZodDto(agencyAdminDeleteSchema) {}
export class AdminAgencyDetailQueryDto extends createZodDto(adminAgencyDetailQuerySchema) {}
export class AgencyLocationUpdateDto extends createZodDto(agencyLocationUpdateSchema) {}
export class AgencyRegistryCheckQueryDto extends createZodDto(agencyRegistryCheckQuerySchema) {}

// ---------- 사무소 홈페이지 + 이용권 ----------
export class AgencySiteRequestDto extends createZodDto(agencySiteRequestSchema) {}
export class AgencySiteUpdateDto extends createZodDto(agencySiteUpdateSchema) {}
export class AgencySiteAvailabilityQueryDto extends createZodDto(
  agencySiteAvailabilityQuerySchema,
) {}
/** GET /sites/:slug — normalised, then the slug rules (an unusable slug is a 400, like other params). */
export class SiteSlugParamDto extends createZodDto(z.object({ slug: siteSlugSchema })) {}
export class AdminAgencySiteListQueryDto extends createZodDto(adminAgencySiteListQuerySchema) {}
export class AdminAgencySiteDecisionDto extends createZodDto(adminAgencySiteDecisionSchema) {}
export class AdminSubscriptionCreateDto extends createZodDto(adminSubscriptionCreateSchema) {}
export class AdminSubscriptionUpdateDto extends createZodDto(adminSubscriptionUpdateSchema) {}
