import { ACTION_CONSENT_TERMS, ERROR_MESSAGES, ErrorCode, type ConsentAction } from '@house/shared';
import { z } from 'zod';
import { api } from './client';
import { ApiError } from './errors';
import { qk } from './query';

/** GET /terms/:type — the fields a consent notice shows (the rest of the document is ignored). */
const actionTermsSchema = z.looseObject({
  version: z.string().min(1),
  title: z.string().default(''),
  content: z.string().default(''),
  effectiveAt: z.string().nullish(),
});

type ActionTermsType<A extends ConsentAction> = (typeof ACTION_CONSENT_TERMS)[A][number];

/** One `consents[]` entry of a submission that needs purpose consents (D8). */
export interface ActionConsent<A extends ConsentAction = ConsentAction> {
  type: ActionTermsType<A>;
  version: string;
}

/** A purpose-consent document as the user reads it next to its checkbox. */
export interface ActionTermsDocument<A extends ConsentAction = ConsentAction> {
  type: ActionTermsType<A>;
  version: string;
  title: string;
  /** Plain text written in the admin (line breaks preserved; never rendered as HTML). */
  content: string;
  effectiveAt: string | null;
}

/** Query key of the documents an action's consent notice shows. */
export const actionTermsKey = (action: ConsentAction) => qk('terms', 'action', action);

/**
 * The current published document of every type the action needs (shared ACTION_CONSENT_TERMS),
 * from GET /terms/:type. The consent UI renders exactly these texts and the submission sends
 * exactly these versions (`actionConsentsOf`) — never a version fetched later, so a Consent row
 * always records the text the user was shown. A type without a published document surfaces as
 * AUTH_CONSENT_UNAVAILABLE (what the server would answer for the submission itself).
 */
export async function fetchActionTerms<A extends ConsentAction>(
  action: A,
  signal?: AbortSignal,
): Promise<ActionTermsDocument<A>[]> {
  const types = ACTION_CONSENT_TERMS[action] as readonly ActionTermsType<A>[];
  return Promise.all(
    types.map(async (type) => {
      try {
        const doc = await api.get(`/terms/${type}`, { schema: actionTermsSchema, signal });
        return {
          type,
          version: doc.version,
          title: doc.title,
          content: doc.content,
          effectiveAt: doc.effectiveAt ?? null,
        };
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

/** `consents` of a submission: the versions of the documents the user was shown. */
export function actionConsentsOf<A extends ConsentAction>(
  docs: readonly ActionTermsDocument<A>[],
): ActionConsent<A>[] {
  return docs.map((d) => ({ type: d.type, version: d.version }));
}

/**
 * `consents` of a submission from the documents the form showed. Without them (they never loaded,
 * e.g. a restored draft submitted at once) the submission is refused locally the way the server
 * would refuse it (AUTH_CONSENT_REQUIRED), so the form asks for the consent again.
 */
export function shownConsents<A extends ConsentAction>(
  docs: readonly ActionTermsDocument<A>[] | undefined,
): ActionConsent<A>[] {
  if (!docs || docs.length === 0) {
    throw new ApiError(400, {
      code: ErrorCode.AUTH_CONSENT_REQUIRED,
      message: ERROR_MESSAGES.AUTH_CONSENT_REQUIRED,
    });
  }
  return actionConsentsOf(docs);
}

/**
 * The server refused the consents because a document changed (or is missing) since the user read
 * it: show the current text again and ask for a new agreement — never resubmit silently.
 */
export function isConsentOutdatedError(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === ErrorCode.AUTH_CONSENT_OUTDATED ||
      error.code === ErrorCode.AUTH_CONSENT_REQUIRED)
  );
}

/** Message next to the consent boxes after `isConsentOutdatedError`. */
export const CONSENT_OUTDATED_MESSAGE =
  '동의 내용이 바뀌었어요. 바뀐 내용을 확인하고 다시 동의해 주세요.';
