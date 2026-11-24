import { type AgencyInviteView } from '@house/shared';
import type Redis from 'ioredis';
export interface InviteRecord {
    id: string;
    agencyId: string;
    codeHash: string;
    codeHint: string;
    label: string | null;
    createdByUserId: string;
    createdAt: number;
    expiresAt: number;
}
/** Uniform random code over the 32-char alphabet (256 % 32 === 0, so no modulo bias). */
export declare function generateInviteCode(): string;
export declare function hashInviteCode(code: string): string;
export declare function toInviteView(r: InviteRecord, code?: string): AgencyInviteView;
/**
 * Staff invite codes in Redis. Only sha256(code) is stored; the code is shown to the owner once.
 * Redemption is single-use via GETDEL on the code key. Records expire on their own (TTL), the
 * per-agency ZSET is pruned lazily.
 */
export declare class AgencyInviteStore {
    private readonly redis;
    constructor(redis: Redis);
    create(input: {
        agencyId: string;
        createdByUserId: string;
        label: string | null;
        ttlSeconds: number;
        now?: number;
    }): Promise<{
        record: InviteRecord;
        code: string;
    }>;
    /** Live invites of an agency, newest first (expired index entries are pruned). */
    listForAgency(agencyId: string, now?: number): Promise<InviteRecord[]>;
    countForAgency(agencyId: string, now?: number): Promise<number>;
    /** Looks up a code without consuming it. */
    peek(code: string, now?: number): Promise<InviteRecord | null>;
    /** Atomically claims the code (single use). Returns null if someone else already used it. */
    consume(code: string, now?: number): Promise<InviteRecord | null>;
    /** Puts a consumed invite back (the join transaction failed after claiming it). */
    restore(record: InviteRecord, now?: number): Promise<void>;
    /** Revokes an invite of `agencyId`; false when it does not exist (or belongs elsewhere). */
    revoke(agencyId: string, inviteId: string, now?: number): Promise<boolean>;
    /** Revokes every invite of an agency (suspension). */
    revokeAll(agencyId: string): Promise<void>;
    private load;
}
