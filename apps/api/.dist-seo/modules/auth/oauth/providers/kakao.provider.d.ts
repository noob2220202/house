import { AppConfig } from '../../../../config/app-config.service';
import { type OAuthHttpClient } from '../oauth-http';
import { type AuthorizeUrlParams, type CodeExchangeParams, type OAuthProfile, type OAuthProvider, type OAuthTokens } from '../oauth-provider';
export declare const KAKAO_ENDPOINTS: {
    readonly authorize: "https://kauth.kakao.com/oauth/authorize";
    readonly token: "https://kauth.kakao.com/oauth/token";
    readonly me: "https://kapi.kakao.com/v2/user/me";
};
/** 카카오 로그인 (REST API). Scopes (nickname, email, phone_number…) are set in the Kakao console. */
export declare class KakaoOAuthProvider implements OAuthProvider {
    private readonly config;
    private readonly http;
    readonly provider: "KAKAO";
    constructor(config: AppConfig, http: OAuthHttpClient);
    isEnabled(): boolean;
    redirectUri(): string;
    buildAuthorizeUrl(p: AuthorizeUrlParams): string;
    exchangeCode(p: CodeExchangeParams): Promise<OAuthTokens>;
    fetchProfile(tokens: OAuthTokens): Promise<OAuthProfile>;
    private clientId;
}
