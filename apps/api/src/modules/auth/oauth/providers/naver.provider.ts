import { Inject, Injectable } from '@nestjs/common';
import { AuthProvider } from '@house/shared';
import { z } from 'zod';
import { AppConfig } from '../../../../config/app-config.service';
import { OAUTH_HTTP, type OAuthHttpClient } from '../oauth-http';
import {
  type AuthorizeUrlParams,
  cleanEmail,
  cleanImageUrl,
  cleanText,
  type CodeExchangeParams,
  normalizeProviderPhone,
  type OAuthProfile,
  type OAuthProvider,
  OAuthProviderError,
  type OAuthTokens,
  parseProviderBody,
} from '../oauth-provider';
import { defaultRedirectUri } from './redirect-uri';

export const NAVER_ENDPOINTS = {
  authorize: 'https://nid.naver.com/oauth2.0/authorize',
  token: 'https://nid.naver.com/oauth2.0/token',
  me: 'https://openapi.naver.com/v1/nid/me',
} as const;

// Naver answers token errors with HTTP 200 + { error, error_description }.
const tokenSchema = z.union([
  z.object({ access_token: z.string().min(1), token_type: z.string().optional() }),
  z.object({ error: z.string(), error_description: z.string().optional() }),
]);

const meSchema = z.object({
  resultcode: z.string(),
  message: z.string().optional(),
  response: z
    .object({
      id: z.string().min(1),
      nickname: z.string().nullish(),
      name: z.string().nullish(),
      email: z.string().nullish(),
      mobile: z.string().nullish(),
      mobile_e164: z.string().nullish(),
      profile_image: z.string().nullish(),
    })
    .optional(),
});

/** 네이버 로그인. Profile fields (이름, 이메일, 휴대전화번호…) are chosen in the Naver developer console. */
@Injectable()
export class NaverOAuthProvider implements OAuthProvider {
  readonly provider = AuthProvider.NAVER;

  constructor(
    private readonly config: AppConfig,
    @Inject(OAUTH_HTTP) private readonly http: OAuthHttpClient,
  ) {}

  isEnabled(): boolean {
    return Boolean(this.config.get('NAVER_CLIENT_ID') && this.config.get('NAVER_CLIENT_SECRET'));
  }

  redirectUri(): string {
    return this.config.get('NAVER_REDIRECT_URI') ?? defaultRedirectUri(this.config, 'naver');
  }

  buildAuthorizeUrl(p: AuthorizeUrlParams): string {
    const url = new URL(NAVER_ENDPOINTS.authorize);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.credentials().clientId,
      redirect_uri: p.redirectUri,
      state: p.state,
    }).toString();
    return url.toString();
  }

  async exchangeCode(p: CodeExchangeParams): Promise<OAuthTokens> {
    const { clientId, clientSecret } = this.credentials();
    const res = await this.http.request({
      method: 'POST',
      url: NAVER_ENDPOINTS.token,
      form: {
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: p.code,
        state: p.state,
      },
    });
    const body = parseProviderBody(this.provider, 'token exchange', res, tokenSchema);
    if ('error' in body) {
      throw new OAuthProviderError(this.provider, `token exchange rejected: ${body.error}`);
    }
    return { accessToken: body.access_token };
  }

  async fetchProfile(tokens: OAuthTokens): Promise<OAuthProfile> {
    const res = await this.http.request({
      method: 'GET',
      url: NAVER_ENDPOINTS.me,
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const me = parseProviderBody(this.provider, 'profile', res, meSchema);
    if (me.resultcode !== '00' || !me.response) {
      throw new OAuthProviderError(this.provider, `profile resultcode ${me.resultcode}`);
    }
    const r = me.response;
    return {
      provider: this.provider,
      providerUserId: r.id,
      email: cleanEmail(r.email),
      // Naver's email is a contact address chosen by the user, not a verified login email.
      emailVerified: false,
      name: cleanText(r.name, 50),
      nickname: cleanText(r.nickname, 30),
      phone: normalizeProviderPhone(r.mobile_e164 ?? r.mobile),
      profileImageUrl: cleanImageUrl(r.profile_image),
    };
  }

  private credentials(): { clientId: string; clientSecret: string } {
    const clientId = this.config.get('NAVER_CLIENT_ID');
    const clientSecret = this.config.get('NAVER_CLIENT_SECRET');
    if (!clientId || !clientSecret) throw new OAuthProviderError(this.provider, 'not configured');
    return { clientId, clientSecret };
  }
}
