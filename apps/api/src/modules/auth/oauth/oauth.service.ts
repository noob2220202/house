import { Injectable, Logger } from '@nestjs/common';
import {
  AUTH_PROVIDER_SLUG,
  type AuthProvider,
  ErrorCode,
  type OAuthCallbackQuery,
  OAuthIntent,
  type OAuthStartQuery,
  UserStatus,
} from '@house/shared';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { isUserPrincipal } from '../../../common/auth/principal';
import { AppException } from '../../../common/errors/app.exception';
import { AppConfig } from '../../../config/app-config.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AUTH_COOKIE_PATHS,
  AUTH_COOKIES,
  OAUTH_STATE_TTL_SECONDS,
  PENDING_SIGNUP_TTL_SECONDS,
  WEB_PATHS,
} from '../auth.constants';
import { SessionService } from '../session/session.service';
import { PendingSignupStore } from '../signup/pending-signup.store';
import { UserSessionService } from '../users/user-session.service';
import { WithdrawnIdentityService } from '../users/withdrawn-identity.service';
import { type OAuthProfile, OAuthProviderError } from './oauth-provider';
import { OAuthProviderRegistry } from './oauth-registry';
import {
  type OAuthStateRecord,
  OAuthStateStore,
  pkceChallenge,
  randomToken,
  sha256Hex,
} from './oauth-state.store';

const BINDING_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** A redirect target on the user site (apps/web). */
type Outcome = { redirectTo: string };

/**
 * Authorization-code flows for every registered provider.
 *  start: state + nonce + PKCE verifier in Redis (single use), state bound to the browser by a cookie
 *  callback: state check → code exchange → profile → login | pending signup | identity link
 * Accounts are linked only through (provider, providerUserId) — never by email.
 * The callback never renders errors itself: it redirects to the web app with ?error=<code>.
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly registry: OAuthProviderRegistry,
    private readonly states: OAuthStateStore,
    private readonly pending: PendingSignupStore,
    private readonly userSessions: UserSessionService,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly withdrawn: WithdrawnIdentityService,
  ) {}

  /** Returns the provider authorization URL to redirect the browser to. */
  async start(
    provider: AuthProvider,
    query: OAuthStartQuery,
    req: Request,
    res: Response,
  ): Promise<string> {
    const impl = this.registry.get(provider);
    let linkUserId: string | null = null;
    if (query.intent === OAuthIntent.LINK) {
      if (!isUserPrincipal(req.principal)) throw AppException.unauthenticated();
      linkUserId = req.principal.userId;
    }
    const binding = this.ensureBindingCookie(req, res);
    const nonce = randomToken();
    const codeVerifier = randomToken(48);
    const state = await this.states.create({
      provider,
      intent: query.intent,
      nonce,
      codeVerifier,
      bindingHash: sha256Hex(binding),
      returnTo: query.returnTo ?? null,
      linkUserId,
    });
    return impl.buildAuthorizeUrl({
      state,
      nonce,
      codeChallenge: pkceChallenge(codeVerifier),
      redirectUri: impl.redirectUri(),
    });
  }

  async callback(
    provider: AuthProvider,
    query: OAuthCallbackQuery,
    req: Request,
    res: Response,
  ): Promise<string> {
    const record = await this.states.consume(query.state);
    if (!record || record.provider !== provider || !this.bindingMatches(req, record)) {
      return this.loginError(ErrorCode.AUTH_OAUTH_STATE_INVALID);
    }
    const fail = (code: ErrorCode): string =>
      record.intent === OAuthIntent.LINK
        ? this.webUrl(record.returnTo ?? WEB_PATHS.ACCOUNT, { error: code })
        : this.loginError(code);

    if (query.error) {
      return fail(
        query.error === 'access_denied'
          ? ErrorCode.AUTH_OAUTH_CANCELLED
          : ErrorCode.AUTH_OAUTH_PROVIDER_ERROR,
      );
    }
    if (!query.code) return fail(ErrorCode.AUTH_OAUTH_PROVIDER_ERROR);

    let profile: OAuthProfile;
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
    } catch (err) {
      if (err instanceof OAuthProviderError) {
        this.logger.warn({ provider, reason: err.message }, 'oauth provider error');
      } else if (err instanceof AppException) {
        return fail(err.code);
      } else {
        this.logger.error({ provider, err }, 'oauth callback failed');
      }
      return fail(ErrorCode.AUTH_OAUTH_PROVIDER_ERROR);
    }

    const outcome =
      record.intent === OAuthIntent.LINK
        ? await this.link(record, profile, req)
        : await this.loginOrSignup(record, profile, req, res);
    return 'error' in outcome ? fail(outcome.error) : outcome.redirectTo;
  }

  private async loginOrSignup(
    record: OAuthStateRecord,
    profile: OAuthProfile,
    req: Request,
    res: Response,
  ): Promise<Outcome | { error: ErrorCode }> {
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
        return { error: ErrorCode.AUTH_REJOIN_COOLDOWN };
      }
      const token = await this.pending.create(profile, record.returnTo);
      res.cookie(AUTH_COOKIES.PENDING_SIGNUP, token, {
        ...this.sessions.baseCookie(),
        httpOnly: true,
        path: AUTH_COOKIE_PATHS.PENDING_SIGNUP,
        maxAge: PENDING_SIGNUP_TTL_SECONDS * 1000,
      });
      return {
        redirectTo: this.webUrl(WEB_PATHS.SIGNUP, {
          provider: AUTH_PROVIDER_SLUG[profile.provider],
        }),
      };
    }

    const { user } = identity;
    if (user.status === UserStatus.SUSPENDED) return { error: ErrorCode.AUTH_ACCOUNT_SUSPENDED };
    if (user.status !== UserStatus.ACTIVE) return { error: ErrorCode.AUTH_ACCOUNT_WITHDRAWN };

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
    return { redirectTo: this.webUrl(record.returnTo ?? WEB_PATHS.HOME) };
  }

  private async link(
    record: OAuthStateRecord,
    profile: OAuthProfile,
    req: Request,
  ): Promise<Outcome | { error: ErrorCode }> {
    const principal = req.principal;
    // The browser finishing the flow must still be logged in as the user who started it.
    if (!isUserPrincipal(principal) || principal.userId !== record.linkUserId) {
      return { error: ErrorCode.AUTH_OAUTH_STATE_INVALID };
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
      redirectTo: this.webUrl(record.returnTo ?? WEB_PATHS.ACCOUNT, {
        linked: AUTH_PROVIDER_SLUG[profile.provider],
      }),
    };
    if (existing) {
      return existing.userId === userId ? done : { error: ErrorCode.AUTH_IDENTITY_DUPLICATE };
    }
    const sameProvider = await this.prisma.identity.count({
      where: { userId, provider: profile.provider },
    });
    if (sameProvider > 0) return { error: ErrorCode.AUTH_PROVIDER_ALREADY_LINKED };
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
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { error: ErrorCode.AUTH_IDENTITY_DUPLICATE };
      }
      throw err;
    }
    return done;
  }

  /** Reuses the browser's binding value so parallel flows (two tabs) both succeed. */
  private ensureBindingCookie(req: Request, res: Response): string {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const existing = cookies?.[AUTH_COOKIES.OAUTH_BINDING];
    const binding = existing && BINDING_PATTERN.test(existing) ? existing : randomToken();
    res.cookie(AUTH_COOKIES.OAUTH_BINDING, binding, {
      ...this.sessions.baseCookie(),
      httpOnly: true,
      path: AUTH_COOKIE_PATHS.OAUTH_BINDING,
      maxAge: OAUTH_STATE_TTL_SECONDS * 1000,
    });
    return binding;
  }

  private bindingMatches(req: Request, record: OAuthStateRecord): boolean {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const binding = cookies?.[AUTH_COOKIES.OAUTH_BINDING];
    return typeof binding === 'string' && sha256Hex(binding) === record.bindingHash;
  }

  private loginError(code: ErrorCode): string {
    return this.webUrl(WEB_PATHS.LOGIN, { error: code });
  }

  /** Absolute URL on PUBLIC_BASE_URL; refuses to leave that origin whatever `path` contains. */
  private webUrl(path: string, params: Record<string, string> = {}): string {
    const base = new URL(this.config.get('PUBLIC_BASE_URL'));
    let url = new URL(path, base);
    if (url.origin !== base.origin) url = new URL(WEB_PATHS.HOME, base);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return url.toString();
  }
}

/** Minimal provider profile snapshot kept on the identity (scrubbed on withdrawal). */
function profileSnapshot(p: OAuthProfile): Prisma.InputJsonValue {
  return { nickname: p.nickname, name: p.name, profileImageUrl: p.profileImageUrl };
}
