import { ERROR_MESSAGES, ErrorCode } from '@house/shared';
import { ApiError, actionConsentsOf, type ActionConsent, type ActionTermsDocument } from '@/lib/api';

/**
 * `consents` of a deal request: the versions of the documents the consent step showed. Without
 * them (the documents never loaded, e.g. a restored draft submitted at once) the submission is
 * refused locally like the server would refuse it, so the wizard returns to the consent step.
 */
export function shownDealConsents(
  docs: readonly ActionTermsDocument<'DEAL_REQUEST'>[] | undefined,
): ActionConsent<'DEAL_REQUEST'>[] {
  if (!docs || docs.length === 0) {
    throw new ApiError(400, {
      code: ErrorCode.AUTH_CONSENT_REQUIRED,
      message: ERROR_MESSAGES.AUTH_CONSENT_REQUIRED,
    });
  }
  return actionConsentsOf(docs);
}
