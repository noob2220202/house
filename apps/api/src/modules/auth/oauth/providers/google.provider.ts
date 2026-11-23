import { Inject, Injectable } from '@nestjs/common';
import { AuthProvider } from '@house/shared';
import { z } from 'zod';
import { AppConfig } from '../../../../config/app-config.service';
import { GoogleIdTokenVerifier } from '../google-id-token.verifier';
import { OAUTH_HTTP, type OAuthHttpClient } from '../oauth-http';
import {
  type AuthorizeUrlParams,
  cleanEmail,
  cleanImageUrl,
  cleanText,
  type CodeExchangeParams,
  type OAuthProfile,
  type OAuthProvider,
  OAuthProviderError,
  type OAuthTokens,
  parseProviderBody,
  type ProfileContext,
} from '../oauth-provider';
import { defaultRedirectUri } from './redirect-uri';

export const GOOGLE_ENDPOINTS = {
  authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
  token: 'https://oauth2.googleapis.com/token',
} as const;

const tokenSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1),
  token_type: z.string().optional(),
});

/**
 * Google (OIDC): authorization code + PKCE (S256) + nonce. The profile comes from the verified
 * id_token — no userinfo call, so nothing unverified feeds the account.
 */
@Injectable()
export class GoogleOAuthProvider implements OAuthProvider {
  readonly provider = AuthProvider.GOOGLE;

  constructor(
    private readonly config: AppConfig,
    @Inject(OAUTH_HTTP) private readonly http: OAuthHttpClient,
    private readonly verifier: GoogleIdTokenVerifier,
  ) {}

  isEnabled(): boolean {
    return Boolean(this.config.get('GOOGLE_CLIENT_ID') && this.config.get('GOOGLE_CLIENT_SECRET'));
  }

  redirectUri(): string {
    return this.config.get('GOOGLE_REDIRECT_URI') ?? defaultRedirectUri(this.config, 'google');
  }

  buildAuthorizeUrl(p: AuthorizeUrlParams): string {
    const url = new URL(GOOGLE_ENDPOINTS.authorize);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.credentials().clientId,
      redirect_uri: p.redirectUri,
      scope: 'openid email profile',
      state: p.state,
      nonce: p.nonce,
      code_challenge: p.codeChallenge,
      code_challenge_method: 'S256',
      prompt: 'select_account',
    }).toString();
    return url.toString();
  }

  async exchangeCode(p: CodeExchangeParams): Promise<OAuthTokens> {
    const { clientId, clientSecret } = this.credentials();
    const res = await this.http.request({
      method: 'POST',
      url: GOOGLE_ENDPOINTS.token,
      form: {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: p.redirectUri,
        code: p.code,
        code_verifier: p.codeVerifier,
      },
    });
    const body = parseProviderBody(this.provider, 'token exchange', res, tokenSchema);
    return { accessToken: body.access_token, idToken: body.id_token };
  }

  async fetchProfile(tokens: OAuthTokens, ctx: ProfileContext): Promise<OAuthProfile> {
    if (!tokens.idToken) throw new OAuthProviderError(this.provider, 'missing id_token');
    const c = await this.verifier.verify(tokens.idToken, {
      audience: this.credentials().clientId,
      nonce: ctx.nonce,
    });
    const email = cleanEmail(c.email);
    const verified = c.email_verified === true || c.email_verified === 'true';
    return {
      provider: this.provider,
      providerUserId: c.sub,
      email,
      emailVerified: email !== null && verified,
      name: cleanText(c.name, 50),
      nickname: cleanText(c.given_name ?? c.name, 30),
      phone: null,
      profileImageUrl: cleanImageUrl(c.picture),
    };
  }

  private credentials(): { clientId: string; clientSecret: string } {
    const clientId = this.config.get('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new OAuthProviderError(this.provider, 'not configured');
    return { clientId, clientSecret };
  }
}
