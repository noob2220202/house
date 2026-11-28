import {
  agencyInquiryDeleteSchema,
  agencyInquiryListQuerySchema,
  agencyInquiryReadAllSchema,
  agencyInquiryUpdateSchema,
  idParamSchema,
  inquiryContactEventSchema,
  inquiryCreateSchema,
  inquiryReplySchema,
  paginationQuerySchema,
} from '@house/shared';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';

export class IdParamDto extends createZodDto(idParamSchema) {}
export class InquiryCreateDto extends createZodDto(inquiryCreateSchema) {}
export class InquiryContactEventDto extends createZodDto(inquiryContactEventSchema) {}
export class AgencyInquiryListQueryDto extends createZodDto(agencyInquiryListQuerySchema) {}
export class AgencyInquiryUpdateDto extends createZodDto(agencyInquiryUpdateSchema) {}
export class InquiryReplyDto extends createZodDto(inquiryReplySchema) {}
export class AgencyInquiryReadAllDto extends createZodDto(agencyInquiryReadAllSchema) {}
export class AgencyInquiryDeleteDto extends createZodDto(agencyInquiryDeleteSchema) {}
/** GET /me/inquiries (page, pageSize ≤ 100). */
export class MyInquiryListQueryDto extends createZodDto(paginationQuerySchema) {}
