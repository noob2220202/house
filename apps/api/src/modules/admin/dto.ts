import {
  adminAccountCreateSchema,
  adminAccountListQuerySchema,
  adminAccountUpdateSchema,
  adminListingListQuerySchema,
  adminListingModerationSchema,
  adminPasswordResetSchema,
  auditLogQuerySchema,
  faqAdminListQuerySchema,
  faqInputSchema,
  faqListQuerySchema,
  faqOrderSchema,
  faqUpdateSchema,
  idParamSchema,
  localVideoAdminListQuerySchema,
  localVideoInputSchema,
  localVideoListQuerySchema,
  localVideoUpdateSchema,
  memberListQuerySchema,
  memberSuspendSchema,
  noticeAdminListQuerySchema,
  noticeInputSchema,
  noticeUpdateSchema,
  paginationQuerySchema,
  reportCreateSchema,
  reportListQuerySchema,
  reportResolveSchema,
  reportReviewSchema,
  siteSettingKeyParamSchema,
  termsAdminListQuerySchema,
  termsDocumentInputSchema,
  termsPublishSchema,
  termsDocumentUpdateSchema,
} from '@house/shared';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';

export class IdParamDto extends createZodDto(idParamSchema) {}
export class PaginationQueryDto extends createZodDto(paginationQuerySchema) {}

export class ReportCreateDto extends createZodDto(reportCreateSchema) {}
export class ReportListQueryDto extends createZodDto(reportListQuerySchema) {}
export class ReportReviewDto extends createZodDto(reportReviewSchema) {}
export class ReportResolveDto extends createZodDto(reportResolveSchema) {}

export class NoticeInputDto extends createZodDto(noticeInputSchema) {}
export class NoticeUpdateDto extends createZodDto(noticeUpdateSchema) {}
export class NoticeAdminListQueryDto extends createZodDto(noticeAdminListQuerySchema) {}

export class FaqInputDto extends createZodDto(faqInputSchema) {}
export class FaqUpdateDto extends createZodDto(faqUpdateSchema) {}
export class FaqOrderDto extends createZodDto(faqOrderSchema) {}
export class FaqListQueryDto extends createZodDto(faqListQuerySchema) {}
export class FaqAdminListQueryDto extends createZodDto(faqAdminListQuerySchema) {}

export class LocalVideoInputDto extends createZodDto(localVideoInputSchema) {}
export class LocalVideoUpdateDto extends createZodDto(localVideoUpdateSchema) {}
export class LocalVideoListQueryDto extends createZodDto(localVideoListQuerySchema) {}
export class LocalVideoAdminListQueryDto extends createZodDto(localVideoAdminListQuerySchema) {}

export class TermsInputDto extends createZodDto(termsDocumentInputSchema) {}
export class TermsUpdateDto extends createZodDto(termsDocumentUpdateSchema) {}
export class TermsAdminListQueryDto extends createZodDto(termsAdminListQuerySchema) {}
export class TermsPublishDto extends createZodDto(termsPublishSchema) {}

export class SiteSettingKeyParamDto extends createZodDto(siteSettingKeyParamSchema) {}

export class MemberListQueryDto extends createZodDto(memberListQuerySchema) {}
export class MemberSuspendDto extends createZodDto(memberSuspendSchema) {}

export class AdminAccountCreateDto extends createZodDto(adminAccountCreateSchema) {}
export class AdminAccountUpdateDto extends createZodDto(adminAccountUpdateSchema) {}
export class AdminAccountListQueryDto extends createZodDto(adminAccountListQuerySchema) {}
export class AdminPasswordResetDto extends createZodDto(adminPasswordResetSchema) {}

export class AdminListingListQueryDto extends createZodDto(adminListingListQuerySchema) {}
export class AdminListingModerationDto extends createZodDto(adminListingModerationSchema) {}

export class AuditLogQueryDto extends createZodDto(auditLogQuerySchema) {}
