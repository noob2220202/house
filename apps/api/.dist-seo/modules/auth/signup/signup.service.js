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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignupService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const client_1 = require("@prisma/client");
const app_exception_1 = require("../../../common/errors/app.exception");
const prisma_service_1 = require("../../../prisma/prisma.service");
const auth_constants_1 = require("../auth.constants");
const session_service_1 = require("../session/session.service");
const terms_service_1 = require("../terms/terms.service");
const account_service_1 = require("../users/account.service");
const user_session_service_1 = require("../users/user-session.service");
const withdrawn_identity_service_1 = require("../users/withdrawn-identity.service");
const pending_signup_store_1 = require("./pending-signup.store");
const signupExpired = () => new app_exception_1.AppException(shared_1.ErrorCode.AUTH_SIGNUP_EXPIRED, { status: common_1.HttpStatus.UNAUTHORIZED });
/**
 * Second half of a first social login: 만 14세 이상 confirmation (schema-enforced, stored as
 * ageConfirmedAt) + terms consent → User + Identity + consents → session.
 */
let SignupService = class SignupService {
    constructor(pending, terms, prisma, sessions, userSessions, accounts, withdrawn) {
        this.pending = pending;
        this.terms = terms;
        this.prisma = prisma;
        this.sessions = sessions;
        this.userSessions = userSessions;
        this.accounts = accounts;
        this.withdrawn = withdrawn;
    }
    /** Prefill for the signup form (the provider profile of this browser's pending signup). */
    async describe(req) {
        const { pending } = await this.load(req);
        const p = pending.profile;
        return {
            provider: p.provider,
            prefill: {
                nickname: p.nickname,
                name: p.name,
                email: p.email,
                phone: p.phone,
                profileImageUrl: p.profileImageUrl,
            },
            terms: (await this.terms.current()).map(terms_service_1.toTermsSummary),
        };
    }
    async complete(req, res, dto) {
        const { token, pending } = await this.load(req);
        const profile = pending.profile;
        const user = await this.prisma
            .$transaction(async (tx) => {
            const now = new Date();
            // Re-checked here: the cooldown may have started after the OAuth callback.
            if (await this.withdrawn.inCooldown(profile, now, tx)) {
                throw app_exception_1.AppException.forbidden(shared_1.ErrorCode.AUTH_REJOIN_COOLDOWN);
            }
            const current = await this.terms.current(now, tx);
            this.terms.validate(current, dto.consents, { requireAll: true });
            const decisions = [...dto.consents];
            let marketingOptIn = dto.marketingOptIn;
            const marketing = current.find((d) => d.type === shared_1.TermsType.MARKETING);
            if (marketing) {
                const given = decisions.find((d) => d.termsDocumentId === marketing.id);
                if (given)
                    marketingOptIn = given.agreed;
                else
                    decisions.push({ termsDocumentId: marketing.id, agreed: marketingOptIn });
            }
            const created = await tx.user.create({
                data: {
                    email: profile.email,
                    name: profile.name,
                    nickname: dto.nickname,
                    // undefined = keep the provider's number (if granted); null = the user removed it.
                    phone: dto.phone === undefined ? profile.phone : dto.phone,
                    profileImageUrl: profile.profileImageUrl,
                    role: shared_1.UserRole.USER,
                    marketingOptIn,
                    marketingOptInAt: marketingOptIn ? now : null,
                    ageConfirmedAt: now,
                    identities: {
                        create: {
                            provider: profile.provider,
                            providerUserId: profile.providerUserId,
                            email: profile.email,
                            emailVerified: profile.emailVerified,
                            profile: {
                                nickname: profile.nickname,
                                name: profile.name,
                                profileImageUrl: profile.profileImageUrl,
                            },
                            lastUsedAt: new Date(),
                        },
                    },
                },
            });
            await this.terms.record(tx, created.id, decisions);
            return created;
        })
            .catch((err) => {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw app_exception_1.AppException.conflict(shared_1.ErrorCode.AUTH_IDENTITY_DUPLICATE);
            }
            throw err;
        });
        await this.pending.delete(token);
        res.clearCookie(auth_constants_1.AUTH_COOKIES.PENDING_SIGNUP, {
            ...this.sessions.baseCookie(),
            path: auth_constants_1.AUTH_COOKIE_PATHS.PENDING_SIGNUP,
        });
        const record = await this.userSessions.start(req, res, user);
        const me = await this.accounts.me({
            kind: 'USER',
            userId: user.id,
            role: user.role,
            agencyId: record.agencyId,
            sessionId: record.id,
        });
        return { user: me, returnTo: pending.returnTo, csrfToken: record.csrfToken };
    }
    async load(req) {
        const cookies = req.cookies;
        const token = cookies?.[auth_constants_1.AUTH_COOKIES.PENDING_SIGNUP];
        const pending = await this.pending.get(token);
        if (!token || !pending)
            throw signupExpired();
        return { token, pending };
    }
};
exports.SignupService = SignupService;
exports.SignupService = SignupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pending_signup_store_1.PendingSignupStore,
        terms_service_1.TermsService,
        prisma_service_1.PrismaService,
        session_service_1.SessionService,
        user_session_service_1.UserSessionService,
        account_service_1.AccountService,
        withdrawn_identity_service_1.WithdrawnIdentityService])
], SignupService);
//# sourceMappingURL=signup.service.js.map