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

export const KAKAO_ENDPOINTS = {
  authorize: 'https://kauth.kakao.com/oauth/authorize',
  token: 'https://kauth.kakao.com/oauth/token',
  me: 'https://kapi.kakao.com/v2/user/me',
} as const;

const tokenSchema = z.object({ access_token: z.string().min(1), token_type: z.string() });

const meSchema = z.object({
  id: z.union([z.number().int(), z.string().regex(/^\d+$/)]),
  kakao_account: z
    .object({
      profile: z
        .object({
          nickname: z.string().nullish(),
          profile_image_url: z.string().nullish(),
          is_default_image: z.boolean().nullish(),
        })
        .nullish(),
      name: z.string().nullish(),
      email: z.string().nullish(),
      is_email_valid: z.boolean().nullish(),
      is_email_verified: z.boolean().nullish(),
      phone_number: z.string().nullish(),
    })
    .nullish(),
});

/** 카카오 로그인 (REST API). Scopes (nickname, email, phone_number…) are set in the Kakao console. */
@Injectable()
export class KakaoOAuthProvider implements OAuthProvider {
  readonly provider = AuthProvider.KAKAO;

  constructor(
    private readonly config: AppConfig,
    @Inject(OAUTH_HTTP) private readonly http: OAuthHttpClient,
  ) {}

  isEnabled(): boolean {
    return Boolean(this.config.get('KAKAO_CLIENT_ID'));
  }

  redirectUri(): string {
    return this.config.get('KAKAO_REDIRECT_URI') ?? defaultRedirectUri(this.config, 'kakao');
  }

  buildAuthorizeUrl(p: AuthorizeUrlParams): string {
    const url = new URL(KAKAO_ENDPOINTS.authorize);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId(),
      redirect_uri: p.redirectUri,
      state: p.state,
    }).toString();
    return url.toString();
  }

  async exchangeCode(p: CodeExchangeParams): Promise<OAuthTokens> {
    const form: Record<string, string> = {
      grant_type: 'authorization_code',
      client_id: this.clientId(),
      redirect_uri: p.redirectUri,
      code: p.code,
    };
    const secret = this.config.get('KAKAO_CLIENT_SECRET');
    if (secret) form.client_secret = secret;
    const res = await this.http.request({ method: 'POST', url: KAKAO_ENDPOINTS.token, form });
    const body = parseProviderBody(this.provider, 'token exchange', res, tokenSchema);
    return { accessToken: body.access_token };
  }

  async fetchProfile(tokens: OAuthTokens): Promise<OAuthProfile> {
    const res = await this.http.request({
      method: 'GET',
      url: KAKAO_ENDPOINTS.me,
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const me = parseProviderBody(this.provider, 'profile', res, meSchema);
    const account = me.kakao_account ?? {};
    const email = account.is_email_valid === false ? null : cleanEmail(account.email);
    return {
      provider: this.provider,
      providerUserId: String(me.id),
      email,
      emailVerified: email !== null && account.is_email_verified === true,
      name: cleanText(account.name, 50),
      nickname: cleanText(account.profile?.nickname, 30),
      phone: normalizeProviderPhone(account.phone_number),
      profileImageUrl: account.profile?.is_default_image
        ? null
        : cleanImageUrl(account.profile?.profile_image_url),
    };
  }

  private clientId(): string {
    const id = this.config.get('KAKAO_CLIENT_ID');
    if (!id) throw new OAuthProviderError(this.provider, 'not configured');
    return id;
  }
}
