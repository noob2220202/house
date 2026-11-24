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
var OAuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthService = void 0;
const common_1 = require("@nestjs/common");
const shared_1 = require("@house/shared");
const client_1 = require("@prisma/client");
const principal_1 = require("../../../common/auth/principal");
const app_exception_1 = require("../../../common/errors/app.exception");
const app_config_service_1 = require("../../../config/app-config.service");
const prisma_service_1 = require("../../../prisma/prisma.service");
const auth_constants_1 = require("../auth.constants");
const session_service_1 = require("../session/session.service");
const pending_signup_store_1 = require("../signup/pending-signup.store");
const suspended_withdraw_store_1 = require("../users/suspended-withdraw.store");
const user_session_service_1 = require("../users/user-session.service");
const withdrawn_identity_service_1 = require("../users/withdrawn-identity.service");
const oauth_provider_1 = require("./oauth-provider");
const oauth_registry_1 = require("./oauth-registry");
const oauth_state_store_1 = require("./oauth-state.store");
const BINDING_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/**
 * Authorization-code flows for every registered provider.
 *  start: state + nonce + PKCE verifier in Redis (single use), state bound to the browser by a cookie
 *  callback: state check → code exchange → profile → login | pending signup | identity link
 *            (a suspended member gets no session, only a withdrawal ticket: SuspendedWithdrawStore)
 * Accounts are linked only through (provider, providerUserId) — never by email.
 * The callback never renders errors itself: it redirects to the web app with ?error=<code>.
 */
let OAuthService = OAuthService_1 = class OAuthService {
    constructor(registry, states, pending, userSessions, sessions, prisma, config, withdrawn, suspendedWithdraw) {
        this.registry = registry;
        this.states = states;
        this.pending = pending;
        this.userSessions = userSessions;
        this.sessions = sessions;
        this.prisma = prisma;
        this.config = config;
        this.withdrawn = withdrawn;
        this.suspendedWithdraw = suspendedWithdraw;
        this.logger = new common_1.Logger(OAuthService_1.name);
    }
    /** Returns the provider authorization URL to redirect the browser to. */
    async start(provider, query, req, res) {
        const impl = this.registry.get(provider);
        let linkUserId = null;
        if (query.intent === shared_1.OAuthIntent.LINK) {
            if (!(0, principal_1.isUserPrincipal)(req.principal))
                throw app_exception_1.AppException.unauthenticated();
            linkUserId = req.principal.userId;
        }
        const binding = this.ensureBindingCookie(req, res);
        const nonce = (0, oauth_state_store_1.randomToken)();
        const codeVerifier = (0, oauth_state_store_1.randomToken)(48);
        const state = await this.states.create({
            provider,
            intent: query.intent,
            nonce,
            codeVerifier,
            bindingHash: (0, oauth_state_store_1.sha256Hex)(binding),
            returnTo: query.returnTo ?? null,
            linkUserId,
        });
        return impl.buildAuthorizeUrl({
            state,
            nonce,
            codeChallenge: (0, oauth_state_store_1.pkceChallenge)(codeVerifier),
            redirectUri: impl.redirectUri(),
        });
    }
    async callback(provider, query, req, res) {
        const record = await this.states.consume(query.state);
        if (!record || record.provider !== provider || !this.bindingMatches(req, record)) {
            return this.loginError(shared_1.ErrorCode.AUTH_OAUTH_STATE_INVALID);
        }
        const fail = (code) => record.intent === shared_1.OAuthIntent.LINK
            ? this.webUrl(record.returnTo ?? auth_constants_1.WEB_PATHS.ACCOUNT, { error: code })
            : this.loginError(code);
        if (query.error) {
            return fail(query.error === 'access_denied'
                ? shared_1.ErrorCode.AUTH_OAUTH_CANCELLED
                : shared_1.ErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
        }
        if (!query.code)
            return fail(shared_1.ErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
        let profile;
        try {
            const impl = this.registry.get(provider);
            const redirectUri = impl.redirectUri();
            const tokens = await impl.exchangeCode({
                code: query.code,
                state: query.state,
                codeVerifier: record.codeVerifier,
                redirectUri,
            });
            profile = await impl.fetchProfile(tokens, { nonce: record.nonce });
        }
        catch (err) {
            if (err instanceof oauth_provider_1.OAuthProviderError) {
                this.logger.warn({ provider, reason: err.message }, 'oauth provider error');
            }
            else if (err instanceof app_exception_1.AppException) {
                return fail(err.code);
            }
            else {
                this.logger.error({ provider, err }, 'oauth callback failed');
            }
            return fail(shared_1.ErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
        }
        const outcome = record.intent === shared_1.OAuthIntent.LINK
            ? await this.link(record, profile, req)
            : await this.loginOrSignup(record, profile, req, res);
        return 'error' in outcome ? fail(outcome.error) : outcome.redirectTo;
    }
    async loginOrSignup(record, profile, req, res) {
        const identity = await this.prisma.identity.findUnique({
            where: {
                provider_providerUserId: {
                    provider: profile.provider,
                    providerUserId: profile.providerUserId,
                },
            },
            include: { user: { select: { id: true, role: true, status: true } } },
        });
        if (!identity) {
            if (await this.withdrawn.inCooldown(profile)) {
                this.logger.warn({ provider: profile.provider }, 'signup refused: rejoin cooldown');
                return { error: shared_1.ErrorCode.AUTH_REJOIN_COOLDOWN };
            }
            const token = await this.pending.create(profile, record.returnTo);
            res.cookie(auth_constants_1.AUTH_COOKIES.PENDING_SIGNUP, token, {
                ...this.sessions.baseCookie(),
                httpOnly: true,
                path: auth_constants_1.AUTH_COOKIE_PATHS.PENDING_SIGNUP,
                maxAge: auth_constants_1.PENDING_SIGNUP_TTL_SECONDS * 1000,
            });
            return {
                redirectTo: this.webUrl(auth_constants_1.WEB_PATHS.SIGNUP, {
                    provider: shared_1.AUTH_PROVIDER_SLUG[profile.provider],
                }),
            };
        }
        const { user } = identity;
        if (user.status === shared_1.UserStatus.SUSPENDED) {
            // No session, but a single-use ticket so the member can still withdraw (POST /auth/withdraw).
            const ticket = await this.suspendedWithdraw.create(user.id);
            res.cookie(auth_constants_1.AUTH_COOKIES.SUSPENDED_WITHDRAW, ticket, {
                ...this.sessions.baseCookie(),
                httpOnly: true,
                path: auth_constants_1.AUTH_COOKIE_PATHS.SUSPENDED_WITHDRAW,
                maxAge: auth_constants_1.SUSPENDED_WITHDRAW_TTL_SECONDS * 1000,
            });
            return {
                redirectTo: this.webUrl(auth_constants_1.WEB_PATHS.LOGIN, {
                    error: shared_1.ErrorCode.AUTH_ACCOUNT_SUSPENDED,
                    withdrawable: '1',
                }),
            };
        }
        if (user.status !== shared_1.UserStatus.ACTIVE)
            return { error: shared_1.ErrorCode.AUTH_ACCOUNT_WITHDRAWN };
        await this.prisma.identity.update({
            where: { id: identity.id },
            data: {
                lastUsedAt: new Date(),
                email: profile.email,
                emailVerified: profile.emailVerified,
                profile: profileSnapshot(profile),
            },
        });
        await this.userSessions.start(req, res, user);
        return { redirectTo: this.webUrl(record.returnTo ?? auth_constants_1.WEB_PATHS.HOME) };
    }
    async link(record, profile, req) {
        const principal = req.principal;
        // The browser finishing the flow must still be logged in as the user who started it.
        if (!(0, principal_1.isUserPrincipal)(principal) || principal.userId !== record.linkUserId) {
            return { error: shared_1.ErrorCode.AUTH_OAUTH_STATE_INVALID };
        }
        const userId = principal.userId;
        const existing = await this.prisma.identity.findUnique({
            where: {
                provider_providerUserId: {
                    provider: profile.provider,
                    providerUserId: profile.providerUserId,
                },
            },
            select: { userId: true },
        });
        const done = {
            redirectTo: this.webUrl(record.returnTo ?? auth_constants_1.WEB_PATHS.ACCOUNT, {
                linked: shared_1.AUTH_PROVIDER_SLUG[profile.provider],
            }),
        };
        if (existing) {
            return existing.userId === userId ? done : { error: shared_1.ErrorCode.AUTH_IDENTITY_DUPLICATE };
        }
        const sameProvider = await this.prisma.identity.count({
            where: { userId, provider: profile.provider },
        });
        if (sameProvider > 0)
            return { error: shared_1.ErrorCode.AUTH_PROVIDER_ALREADY_LINKED };
        try {
            await this.prisma.identity.create({
                data: {
                    userId,
                    provider: profile.provider,
                    providerUserId: profile.providerUserId,
                    email: profile.email,
                    emailVerified: profile.emailVerified,
                    profile: profileSnapshot(profile),
                    lastUsedAt: new Date(),
                },
            });
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                return { error: shared_1.ErrorCode.AUTH_IDENTITY_DUPLICATE };
            }
            throw err;
        }
        return done;
    }
    /** Reuses the browser's binding value so parallel flows (two tabs) both succeed. */
    ensureBindingCookie(req, res) {
        const cookies = req.cookies;
        const existing = cookies?.[auth_constants_1.AUTH_COOKIES.OAUTH_BINDING];
        const binding = existing && BINDING_PATTERN.test(existing) ? existing : (0, oauth_state_store_1.randomToken)();
        res.cookie(auth_constants_1.AUTH_COOKIES.OAUTH_BINDING, binding, {
            ...this.sessions.baseCookie(),
            httpOnly: true,
            path: auth_constants_1.AUTH_COOKIE_PATHS.OAUTH_BINDING,
            maxAge: auth_constants_1.OAUTH_STATE_TTL_SECONDS * 1000,
        });
        return binding;
    }
    bindingMatches(req, record) {
        const cookies = req.cookies;
        const binding = cookies?.[auth_constants_1.AUTH_COOKIES.OAUTH_BINDING];
        return typeof binding === 'string' && (0, oauth_state_store_1.sha256Hex)(binding) === record.bindingHash;
    }
    loginError(code) {
        return this.webUrl(auth_constants_1.WEB_PATHS.LOGIN, { error: code });
    }
    /** Absolute URL on PUBLIC_BASE_URL; refuses to leave that origin whatever `path` contains. */
    webUrl(path, params = {}) {
        const base = new URL(this.config.get('PUBLIC_BASE_URL'));
        let url = new URL(path, base);
        if (url.origin !== base.origin)
            url = new URL(auth_constants_1.WEB_PATHS.HOME, base);
        for (const [k, v] of Object.entries(params))
            url.searchParams.set(k, v);
        return url.toString();
    }
};
exports.OAuthService = OAuthService;
exports.OAuthService = OAuthService = OAuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oauth_registry_1.OAuthProviderRegistry,
        oauth_state_store_1.OAuthStateStore,
        pending_signup_store_1.PendingSignupStore,
        user_session_service_1.UserSessionService,
        session_service_1.SessionService,
        prisma_service_1.PrismaService,
        app_config_service_1.AppConfig,
        withdrawn_identity_service_1.WithdrawnIdentityService,
        suspended_withdraw_store_1.SuspendedWithdrawStore])
], OAuthService);
/** Minimal provider profile snapshot kept on the identity (scrubbed on withdrawal). */
function profileSnapshot(p) {
    return { nickname: p.nickname, name: p.name, profileImageUrl: p.profileImageUrl };
}
//# sourceMappingURL=oauth.service.js.map