import { type ConsentRecordInput, type ConsentStatus, type TermsDetail, type TermsSummary, TermsType } from '@house/shared';
import type { TermsDocument } from '@prisma/client';
import { PrismaService, type PrismaTx } from '../../../prisma/prisma.service';
export interface ConsentDecision {
    termsDocumentId: string;
    agreed: boolean;
}
export interface OutdatedConsent {
    type: TermsType;
    version: string;
    currentVersion: string;
}
/** Row of GET /terms/:type/versions. */
export interface TermsVersionSummary extends TermsSummary {
    isCurrent: boolean;
}
export declare function toTermsSummary(d: TermsDocument): TermsSummary;
/**
 * Terms documents (read side; authoring lives in the admin module) and append-only consent records.
 * "Current" = published, effective now, latest effectiveAt per type.
 *
 * Two kinds of documents share the table (shared ACCOUNT_TERMS_TYPES / ACTION_CONSENT_TERMS):
 *  - account terms (이용약관 …): signup, /me/consents, GET /terms and the write guard use only these;
 *  - purpose consents (D8): agreed with one submission (등록 신청, 합류, 내놓기·구하기) through
 *    `consentForAction`, which checks the version the user saw and records it with that submission.
 */
export declare class TermsService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /** Current documents of the given types (default: account terms), in display order. */
    current(now?: Date, db?: PrismaTx, types?: readonly TermsType[]): Promise<TermsDocument[]>;
    /** Current documents of every type, purpose consents included (admin views). */
    currentAll(now?: Date, db?: PrismaTx): Promise<TermsDocument[]>;
    /**
     * Purpose consents of one submission (D8). Every type in `types` must be given exactly at the
     * version that is current at `now`:
     *  - no published document for a type → 503 AUTH_CONSENT_UNAVAILABLE (nothing to agree to);
     *  - a type missing from `given` → 400 AUTH_CONSENT_REQUIRED `{ missing }`;
     *  - an older / unknown version (the form was open while a new version took effect) →
     *    400 AUTH_CONSENT_OUTDATED `{ outdated: [{ type, version, currentVersion }] }`;
     *  - a type that the action does not ask for → 400 AUTH_TERMS_INVALID.
     * Pass the submission's transaction as `db` and call `record()` with the result in it, or use
     * `consentForAction`, so the consent rows commit together with what they consent to.
     */
    verifyActionConsents(types: readonly TermsType[], given: readonly ConsentRecordInput[], now?: Date, db?: PrismaTx): Promise<ConsentDecision[]>;
    /** verifyActionConsents + record, inside the caller's transaction. */
    consentForAction(tx: PrismaTx, userId: string, types: readonly TermsType[], given: readonly ConsentRecordInput[], now?: Date): Promise<void>;
    /**
     * Every published version of a type (history selector), newest first, without content.
     * `isCurrent` marks the version in force now; announced versions (published, effective later)
     * are listed too.
     */
    versions(type: TermsType, now?: Date): Promise<TermsVersionSummary[]>;
    listCurrent(): Promise<TermsSummary[]>;
    /**
     * Current version of a type, or a specific published version (history view). Serves account terms
     * and purpose consents alike (the forms read the version to send back from here).
     */
    getByType(type: TermsType, version?: string): Promise<TermsDetail>;
    /**
     * Checks consent decisions against the current documents.
     *  - every referenced document must be a current one (stale tab → AUTH_TERMS_INVALID)
     *  - a required document can't be declined (AUTH_REQUIRED_TERMS_REVOKE)
     *  - with `requireAll`, every current required document must be agreed (AUTH_TERMS_REQUIRED)
     */
    validate(current: TermsDocument[], decisions: ConsentDecision[], opts: {
        requireAll: boolean;
    }): Map<string, TermsDocument>;
    record(tx: PrismaTx, userId: string, decisions: ConsentDecision[]): Promise<void>;
    /** Latest decision per document for the given ids. */
    latestDecisions(userId: string, termsDocumentIds: string[], db?: PrismaTx): Promise<Map<string, {
        agreed: boolean;
        createdAt: Date;
    }>>;
    status(userId: string): Promise<ConsentStatus[]>;
    /**
     * Required types whose current version the user has not (or no longer) agreed to.
     * `required` (the current required documents) may be passed when the caller already has it.
     */
    pendingRequired(userId: string, required?: TermsDocument[]): Promise<TermsType[]>;
}
