import { ADMIN_ERROR_MESSAGES, AdminErrorCode } from './admin';
import { ADS_ERROR_MESSAGES, AdsErrorCode } from './ads';
import { AGENCIES_ERROR_MESSAGES, AgenciesErrorCode } from './agencies';
import { AUTH_ERROR_MESSAGES, AuthErrorCode } from './auth';
import { COMMON_ERROR_MESSAGES, CommonErrorCode } from './common';
import { COMPLEXES_ERROR_MESSAGES, ComplexesErrorCode } from './complexes';
import { DEAL_REQUESTS_ERROR_MESSAGES, DealRequestsErrorCode } from './deal-requests';
import { HOME_ERROR_MESSAGES, HomeErrorCode } from './home';
import { INQUIRIES_ERROR_MESSAGES, InquiriesErrorCode } from './inquiries';
import { LISTINGS_ERROR_MESSAGES, ListingsErrorCode } from './listings';
import { MEDIA_ERROR_MESSAGES, MediaErrorCode } from './media';

/** All error codes. Each module owns its own file in this folder; add codes there, not here. */
export const ErrorCode = {
  ...CommonErrorCode,
  ...AuthErrorCode,
  ...ListingsErrorCode,
  ...ComplexesErrorCode,
  ...AgenciesErrorCode,
  ...DealRequestsErrorCode,
  ...AdsErrorCode,
  ...MediaErrorCode,
  ...AdminErrorCode,
  ...HomeErrorCode,
  ...InquiriesErrorCode,
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Default user-facing (Korean) message per code. */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  ...COMMON_ERROR_MESSAGES,
  ...AUTH_ERROR_MESSAGES,
  ...LISTINGS_ERROR_MESSAGES,
  ...COMPLEXES_ERROR_MESSAGES,
  ...AGENCIES_ERROR_MESSAGES,
  ...DEAL_REQUESTS_ERROR_MESSAGES,
  ...ADS_ERROR_MESSAGES,
  ...MEDIA_ERROR_MESSAGES,
  ...ADMIN_ERROR_MESSAGES,
  ...HOME_ERROR_MESSAGES,
  ...INQUIRIES_ERROR_MESSAGES,
};

/** Error body returned by every API error response. */
export interface ApiErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
  requestId?: string;
}

export {
  AdminErrorCode,
  AdsErrorCode,
  AgenciesErrorCode,
  AuthErrorCode,
  CommonErrorCode,
  ComplexesErrorCode,
  DealRequestsErrorCode,
  HomeErrorCode,
  InquiriesErrorCode,
  ListingsErrorCode,
  MediaErrorCode,
};
