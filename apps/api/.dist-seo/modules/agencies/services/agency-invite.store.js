"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgencyInviteStore = void 0;
exports.generateInviteCode = generateInviteCode;
exports.hashInviteCode = hashInviteCode;
exports.toInviteView = toInviteView;
const node_crypto_1 = require("node:crypto");
const shared_1 = require("@house/shared");
const common_1 = require("@nestjs/common");
const redis_constants_1 = require("../../../redis/redis.constants");
const constants_1 = require("../constants");
/** Upper bound of agencyInviteCreateSchema.expiresInHours, plus a margin. */
const MAX_INVITE_TTL_SECONDS = 15 * 24 * 60 * 60;
/** Uniform random code over the 32-char alphabet (256 % 32 === 0, so no modulo bias). */
function generateInviteCode() {
    const bytes = (0, node_crypto_1.randomBytes)(shared_1.AGENCY_INVITE_CODE_LENGTH);
    let code = '';
    for (const b of bytes)
        code += shared_1.AGENCY_INVITE_CODE_ALPHABET[b % shared_1.AGENCY_INVITE_CODE_ALPHABET.length];
    return code;
}
function hashInviteCode(code) {
    return (0, node_crypto_1.createHash)('sha256').update(`agency-invite:${code}`).digest('hex');
}
function toInviteView(r, code) {
    return {
        id: r.id,
        ...(code ? { code } : {}),
        codeHint: r.codeHint,
        label: r.label,
        createdAt: new Date(r.createdAt).toISOString(),
        expiresAt: new Date(r.expiresAt).toISOString(),
    };
}
/**
 * Staff invite codes in Redis. Only sha256(code) is stored; the code is shown to the owner once.
 * Redemption is single-use via GETDEL on the code key. Records expire on their own (TTL), the
 * per-agency ZSET is pruned lazily.
 */
let AgencyInviteStore = class AgencyInviteStore {
    constructor(redis) {
        this.redis = redis;
    }
    async create(input) {
        const now = input.now ?? Date.now();
        const code = generateInviteCode();
        const record = {
            id: (0, node_crypto_1.randomBytes)(12).toString('hex'),
            agencyId: input.agencyId,
            codeHash: hashInviteCode(code),
            codeHint: code.slice(-4),
            label: input.label,
            createdByUserId: input.createdByUserId,
            createdAt: now,
            expiresAt: now + input.ttlSeconds * 1000,
        };
        const indexKey = constants_1.AGENCY_REDIS.agencyInvites(input.agencyId);
        await this.redis
            .multi()
            .set(constants_1.AGENCY_REDIS.invite(record.id), JSON.stringify(record), 'EX', input.ttlSeconds)
            .set(constants_1.AGENCY_REDIS.inviteCode(record.codeHash), record.id, 'EX', input.ttlSeconds)
            .zadd(indexKey, record.expiresAt, record.id)
            // Index outlives every invite in it (each add re-arms it to the maximum invite lifetime).
            .expire(indexKey, MAX_INVITE_TTL_SECONDS)
            .exec();
        return { record, code };
    }
    /** Live invites of an agency, newest first (expired index entries are pruned). */
    async listForAgency(agencyId, now = Date.now()) {
        const indexKey = constants_1.AGENCY_REDIS.agencyInvites(agencyId);
        await this.redis.zremrangebyscore(indexKey, '-inf', now);
        const ids = await this.redis.zrange(indexKey, 0, -1);
        if (ids.length === 0)
            return [];
        const raws = await this.redis.mget(...ids.map((id) => constants_1.AGENCY_REDIS.invite(id)));
        const live = [];
        const stale = [];
        raws.forEach((raw, i) => {
            const r = raw ? JSON.parse(raw) : null;
            if (r && r.agencyId === agencyId && r.expiresAt > now)
                live.push(r);
            else
                stale.push(ids[i]);
        });
        if (stale.length > 0)
            await this.redis.zrem(indexKey, ...stale);
        return live.sort((a, b) => b.createdAt - a.createdAt);
    }
    async countForAgency(agencyId, now = Date.now()) {
        return (await this.listForAgency(agencyId, now)).length;
    }
    /** Looks up a code without consuming it. */
    async peek(code, now = Date.now()) {
        const id = await this.redis.get(constants_1.AGENCY_REDIS.inviteCode(hashInviteCode(code)));
        if (!id)
            return null;
        return this.load(id, now);
    }
    /** Atomically claims the code (single use). Returns null if someone else already used it. */
    async consume(code, now = Date.now()) {
        const id = await this.redis.getdel(constants_1.AGENCY_REDIS.inviteCode(hashInviteCode(code)));
        if (!id)
            return null;
        const record = await this.load(id, now);
        if (!record)
            return null;
        await this.redis
            .multi()
            .del(constants_1.AGENCY_REDIS.invite(id))
            .zrem(constants_1.AGENCY_REDIS.agencyInvites(record.agencyId), id)
            .exec();
        return record;
    }
    /** Puts a consumed invite back (the join transaction failed after claiming it). */
    async restore(record, now = Date.now()) {
        const ttlMs = record.expiresAt - now;
        if (ttlMs <= 0)
            return;
        await this.redis
            .multi()
            .set(constants_1.AGENCY_REDIS.invite(record.id), JSON.stringify(record), 'PX', ttlMs)
            .set(constants_1.AGENCY_REDIS.inviteCode(record.codeHash), record.id, 'PX', ttlMs)
            .zadd(constants_1.AGENCY_REDIS.agencyInvites(record.agencyId), record.expiresAt, record.id)
            .exec();
    }
    /** Revokes an invite of `agencyId`; false when it does not exist (or belongs elsewhere). */
    async revoke(agencyId, inviteId, now = Date.now()) {
        const record = await this.load(inviteId, now);
        if (!record || record.agencyId !== agencyId)
            return false;
        await this.redis
            .multi()
            .del(constants_1.AGENCY_REDIS.invite(inviteId))
            .del(constants_1.AGENCY_REDIS.inviteCode(record.codeHash))
            .zrem(constants_1.AGENCY_REDIS.agencyInvites(agencyId), inviteId)
            .exec();
        return true;
    }
    /** Revokes every invite of an agency (suspension). */
    async revokeAll(agencyId) {
        const records = await this.listForAgency(agencyId);
        const multi = this.redis.multi();
        for (const r of records) {
            multi.del(constants_1.AGENCY_REDIS.invite(r.id)).del(constants_1.AGENCY_REDIS.inviteCode(r.codeHash));
        }
        multi.del(constants_1.AGENCY_REDIS.agencyInvites(agencyId));
        await multi.exec();
    }
    async load(id, now) {
        const raw = await this.redis.get(constants_1.AGENCY_REDIS.invite(id));
        if (!raw)
            return null;
        const record = JSON.parse(raw);
        return record.expiresAt > now ? record : null;
    }
};
exports.AgencyInviteStore = AgencyInviteStore;
exports.AgencyInviteStore = AgencyInviteStore = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_constants_1.REDIS)),
    __metadata("design:paramtypes", [Function])
], AgencyInviteStore);
//# sourceMappingURL=agency-invite.store.js.map