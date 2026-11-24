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
var E2eAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.E2eAuthService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const app_exception_1 = require("../../common/errors/app.exception");
const prisma_service_1 = require("../../prisma/prisma.service");
const terms_service_1 = require("../auth/terms/terms.service");
const user_session_service_1 = require("../auth/users/user-session.service");
/**
 * Test-only stand-in for the social login callback: finds (or creates) a member and starts the
 * session through the same UserSessionService.start the real OAuth callback / signup use, so
 * cookies, CSRF token, acting agency and lastLoginAt behave exactly like production.
 */
let E2eAuthService = E2eAuthService_1 = class E2eAuthService {
    constructor(prisma, terms, userSessions) {
        this.prisma = prisma;
        this.terms = terms;
        this.userSessions = userSessions;
        this.logger = new common_1.Logger(E2eAuthService_1.name);
    }
    async login(dto, req, res) {
        let created = false;
        let user = await this.prisma.user.findFirst({
            where: { email: dto.email },
            select: { id: true, role: true, status: true },
        });
        if (!user) {
            if (!dto.create) {
                throw new app_exception_1.AppException(shared_1.ErrorCode.NOT_FOUND, {
                    status: common_1.HttpStatus.NOT_FOUND,
                    message: `e2e login: no member with email ${dto.email}`,
                });
            }
            user = await this.createMember(dto.email, dto.create.nickname);
            created = true;
        }
        // Same refusal as the OAuth callback: only ACTIVE members get a session.
        if (user.status !== shared_1.UserStatus.ACTIVE) {
            throw app_exception_1.AppException.forbidden(user.status === shared_1.UserStatus.SUSPENDED
                ? shared_1.ErrorCode.AUTH_ACCOUNT_SUSPENDED
                : shared_1.ErrorCode.AUTH_ACCOUNT_WITHDRAWN);
        }
        if (dto.agreeTerms)
            await this.agreeRequiredTerms(user.id);
        const record = await this.userSessions.start(req, res, user);
        this.logger.warn({ userId: user.id, created }, 'e2e login (test-only)');
        return {
            userId: user.id,
            role: user.role,
            agencyId: record.agencyId,
            created,
            csrfToken: record.csrfToken,
        };
    }
    /** A member as signup creates one: USER role, 만 14세 확인, one (fake) Kakao identity. */
    createMember(email, nickname) {
        const providerUserId = `e2e-${(0, node_crypto_1.createHash)('sha256').update(email).digest('hex').slice(0, 24)}`;
        return this.prisma.user.create({
            data: {
                email,
                nickname,
                role: shared_1.UserRole.USER,
                status: shared_1.UserStatus.ACTIVE,
                ageConfirmedAt: new Date(),
                identities: {
                    create: {
                        provider: shared_1.AuthProvider.KAKAO,
                        providerUserId,
                        email,
                        emailVerified: true,
                        profile: { nickname, name: null, profileImageUrl: null },
                        lastUsedAt: new Date(),
                    },
                },
            },
            select: { id: true, role: true, status: true },
        });
    }
    async agreeRequiredTerms(userId) {
        const required = (await this.terms.current()).filter((d) => d.isRequired);
        const missing = new Set(await this.terms.pendingRequired(userId, required));
        const decisions = required
            .filter((d) => missing.has(d.type))
            .map((d) => ({ termsDocumentId: d.id, agreed: true }));
        if (decisions.length > 0)
            await this.terms.record(this.prisma, userId, decisions);
    }
};
exports.E2eAuthService = E2eAuthService;
exports.E2eAuthService = E2eAuthService = E2eAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        terms_service_1.TermsService,
        user_session_service_1.UserSessionService])
], E2eAuthService);
//# sourceMappingURL=e2e-auth.service.js.map