import { AppConfig } from '../../../../config/app-config.service';
import { type OAuthHttpClient } from '../oauth-http';
import { type AuthorizeUrlParams, type CodeExchangeParams, type OAuthProfile, type OAuthProvider, type OAuthTokens } from '../oauth-provider';
export declare const NAVER_ENDPOINTS: {
    readonly authorize: "https://nid.naver.com/oauth2.0/authorize";
    readonly token: "https://nid.naver.com/oauth2.0/token";
    readonly me: "https://openapi.naver.com/v1/nid/me";
};
/** 네이버 로그인. Profile fields (이름, 이메일, 휴대전화번호…) are chosen in the Naver developer console. */
export declare class NaverOAuthProvider implements OAuthProvider {
    private readonly config;
    private readonly http;
    readonly provider: "NAVER";
    constructor(config: AppConfig, http: OAuthHttpClient);
    isEnabled(): boolean;
    redirectUri(): string;
    buildAuthorizeUrl(p: AuthorizeUrlParams): string;
    exchangeCode(p: CodeExchangeParams): Promise<OAuthTokens>;
    fetchProfile(tokens: OAuthTokens): Promise<OAuthProfile>;
    private credentials;
}
