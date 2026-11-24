import {
  DEAL_REQUEST_LIMITS,
  csvArray,
  paginationQuerySchema,
  regionCodeSchema,
  adminDealRequestCloseSchema,
  adminDealRequestListQuerySchema,
  agencyDealRequestListQuerySchema,
  agencyProposalListQuerySchema,
  contactGrantParamSchema,
  contactGrantSchema,
  dealRequestCloseSchema,
  idParamSchema,
  myDealRequestListQuerySchema,
  notificationReadSchema,
  proposalAcceptSchema,
  proposalCreateSchema,
} from '@house/shared';
import { z } from 'zod';
import { createZodDto } from '../../common/pipes/zod-validation.pipe';
import {
  notificationFeedQuerySchema,
  notificationScopeQuerySchema,
} from './notifications/notification-scope';

export class IdParamDto extends createZodDto(idParamSchema) {}
export class MyDealRequestListQueryDto extends createZodDto(myDealRequestListQuerySchema) {}
export class DealRequestCloseDto extends createZodDto(dealRequestCloseSchema) {}
export class ContactGrantDto extends createZodDto(contactGrantSchema) {}
export class ContactGrantParamDto extends createZodDto(contactGrantParamSchema) {}
export class ProposalCreateDto extends createZodDto(proposalCreateSchema) {}
export class ProposalAcceptDto extends createZodDto(proposalAcceptSchema) {}
export class AgencyDealRequestListQueryDto extends createZodDto(agencyDealRequestListQuerySchema) {}
export class AgencyProposalListQueryDto extends createZodDto(agencyProposalListQuerySchema) {}
export class NotificationFeedQueryDto extends createZodDto(notificationFeedQuerySchema) {}
export class NotificationScopeQueryDto extends createZodDto(notificationScopeQuerySchema) {}
export class NotificationReadDto extends createZodDto(notificationReadSchema) {}
/**
 * Admin list: shared query + `spam=flagged` (flagged requests) | `spam=suspected` (unflagged OPEN
 * requests with automatic abuse signals — none exist yet, so always empty) as the admin mock has.
 * Local until shared has it.
 */
export const adminDealRequestListQueryWithSpamSchema = adminDealRequestListQuerySchema.extend({
  spam: z.enum(['flagged', 'suspected']).optional(),
});
export type AdminDealRequestListQueryWithSpam = z.infer<
  typeof adminDealRequestListQueryWithSpamSchema
>;
export class AdminDealRequestListQueryDto extends createZodDto(
  adminDealRequestListQueryWithSpamSchema,
) {}
export class AdminDealRequestCloseDto extends createZodDto(adminDealRequestCloseSchema) {}

/** Shortest reason accepted when flagging (admin mock: "사유를 5자 이상 입력해 주세요."). */
export const SPAM_REASON_MIN = 5;
export const SPAM_REASON_MAX = 500;

/**
 * POST /admin/deal-requests/:id/spam-flag — `{ flagged, reason? }` (admin `flagDealRequestSpam`).
 * `reason` is required (≥ 5 chars) when flagging, optional when clearing. Local until shared has it.
 */
export const adminDealRequestSpamFlagSchema = z
  .object({
    flagged: z.boolean({ message: '표시 여부가 올바르지 않습니다.' }),
    reason: z.string().trim().max(SPAM_REASON_MAX).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.flagged && (v.reason ?? '').length < SPAM_REASON_MIN) {
      ctx.addIssue({
        code: 'custom',
        path: ['reason'],
        message: `사유를 ${SPAM_REASON_MIN}자 이상 입력해 주세요.`,
      });
    }
  });
export type AdminDealRequestSpamFlagInput = z.infer<typeof adminDealRequestSpamFlagSchema>;
export class AdminDealRequestSpamFlagDto extends createZodDto(adminDealRequestSpamFlagSchema) {}

/**
 * The create body is a discriminated union (내놓기 | 구하기), which a class cannot extend, so the
 * controller validates it with an explicit `new ZodValidationPipe(dealRequestCreateSchema)`.
 */

/** Search text of the pickers (상호 / 대표 / 주소, 매물 제목 / 단지명). */
const searchText = z.string().trim().max(50).optional();

/**
 * GET /deal-requests/target-agencies?q&emdCode&regionCodes&page&pageSize — agencies a request for
 * the area reaches (web `TargetAgencyQuery`). Local until shared has it.
 */
export const targetAgencyQuerySchema = paginationQuerySchema.extend({
  q: searchText,
  emdCode: regionCodeSchema.optional(),
  regionCodes: csvArray(regionCodeSchema).pipe(
    z.array(z.string()).max(DEAL_REQUEST_LIMITS.MAX_REGION_CODES).optional(),
  ),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type TargetAgencyQuery = z.infer<typeof targetAgencyQuerySchema>;
export class TargetAgencyQueryDto extends createZodDto(targetAgencyQuerySchema) {}

/** GET /deal-requests/address-match?roadAddress&buildingName&bcode (Kakao postcode result). */
export const addressMatchQuerySchema = z.object({
  roadAddress: z.string().trim().min(1, '주소를 입력해 주세요.').max(200),
  buildingName: z.string().trim().max(100).optional(),
  bcode: regionCodeSchema.optional(),
});
export type AddressMatchQuery = z.infer<typeof addressMatchQuerySchema>;
export class AddressMatchQueryDto extends createZodDto(addressMatchQuerySchema) {}

/** GET /agency/deal-requests/:id/listing-candidates?q&page&pageSize */
export const listingCandidateQuerySchema = paginationQuerySchema.extend({
  q: searchText,
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListingCandidateQuery = z.infer<typeof listingCandidateQuerySchema>;
export class ListingCandidateQueryDto extends createZodDto(listingCandidateQuerySchema) {}
