import {
  adminDealRequestCloseSchema,
  adminDealRequestListQuerySchema,
  agencyDealRequestListQuerySchema,
  agencyProposalListQuerySchema,
  contactGrantParamSchema,
  contactGrantSchema,
  dealRequestCloseSchema,
  idParamSchema,
  myDealRequestListQuerySchema,
  notificationListQuerySchema,
  notificationReadSchema,
  proposalAcceptSchema,
  proposalCreateSchema,
} from '@house/shared';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';

export class IdParamDto extends createZodDto(idParamSchema) {}
export class MyDealRequestListQueryDto extends createZodDto(myDealRequestListQuerySchema) {}
export class DealRequestCloseDto extends createZodDto(dealRequestCloseSchema) {}
export class ContactGrantDto extends createZodDto(contactGrantSchema) {}
export class ContactGrantParamDto extends createZodDto(contactGrantParamSchema) {}
export class ProposalCreateDto extends createZodDto(proposalCreateSchema) {}
export class ProposalAcceptDto extends createZodDto(proposalAcceptSchema) {}
export class AgencyDealRequestListQueryDto extends createZodDto(agencyDealRequestListQuerySchema) {}
export class AgencyProposalListQueryDto extends createZodDto(agencyProposalListQuerySchema) {}
export class NotificationListQueryDto extends createZodDto(notificationListQuerySchema) {}
export class NotificationReadDto extends createZodDto(notificationReadSchema) {}
export class AdminDealRequestListQueryDto extends createZodDto(adminDealRequestListQuerySchema) {}
export class AdminDealRequestCloseDto extends createZodDto(adminDealRequestCloseSchema) {}

/**
 * The create body is a discriminated union (내놓기 | 구하기), which a class cannot extend, so the
 * controller validates it with an explicit `new ZodValidationPipe(dealRequestCreateSchema)`.
 */
