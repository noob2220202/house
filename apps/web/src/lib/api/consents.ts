import { ACTION_CONSENT_TERMS, ERROR_MESSAGES, ErrorCode, type ConsentAction } from '@house/shared';
import { z } from 'zod';
import { api } from './client';
import { ApiError } from './errors';

/** Only the version of GET /terms/:type matters here (the rest of the document is ignored). */
const currentVersionSchema = z.looseObject({ version: z.string().min(1) });

/** One `consents[]` entry of a submission that needs purpose consents (D8). */
export interface ActionConsent<A extends ConsentAction = ConsentAction> {
  type: (typeof ACTION_CONSENT_TERMS)[A][number];
  version: string;
}

/**
 * The `consents` of a submission (D8): the current published version of every document the action
 * needs (shared ACTION_CONSENT_TERMS), read from GET /terms/:type right before the submission so
 * the server never refuses a stale version. Call it only after the user ticked the consent boxes.
 * A type without a published document surfaces as AUTH_CONSENT_UNAVAILABLE (what the server
 * would answer for the submission itself).
 */
export async function fetchActionConsents<A extends ConsentAction>(
  action: A,
  signal?: AbortSignal,
): Promise<ActionConsent<A>[]> {
  const types = ACTION_CONSENT_TERMS[action] as readonly ActionConsent<A>['type'][];
  return Promise.all(
    types.map(async (type) => {
      try {
        const doc = await api.get(`/terms/${type}`, { schema: currentVersionSchema, signal });
        return { type, version: doc.version };
      } catch (error) {
        if (error instanceof ApiError && error.isNotFound) {
          throw new ApiError(503, {
            code: ErrorCode.AUTH_CONSENT_UNAVAILABLE,
            message: ERROR_MESSAGES.AUTH_CONSENT_UNAVAILABLE,
          });
        }
        throw error;
      }
    }),
  );
}
