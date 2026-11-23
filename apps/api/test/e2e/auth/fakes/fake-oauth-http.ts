import { generateKeyPairSync, type KeyObject, sign } from 'node:crypto';
import type {
  OAuthHttpClient,
  OAuthHttpRequest,
  OAuthHttpResponse,
} from '../../../../src/modules/auth/oauth/oauth-http';
import { GOOGLE_JWKS_URL } from '../../../../src/modules/auth/oauth/google-id-token.verifier';
import { GOOGLE_ENDPOINTS } from '../../../../src/modules/auth/oauth/providers/google.provider';
import { KAKAO_ENDPOINTS } from '../../../../src/modules/auth/oauth/providers/kakao.provider';
import { NAVER_ENDPOINTS } from '../../../../src/modules/auth/oauth/providers/naver.provider';

export const GOOGLE_TEST_CLIENT_ID = 'test-google-client.apps.googleusercontent.com';

export interface KakaoFixture {
  id: number;
  nickname?: string;
  email?: string;
  phone?: string;
  name?: string;
}

export interface NaverFixture {
  id: string;
  nickname?: string;
  email?: string;
  mobile?: string;
  name?: string;
}

export interface GoogleFixture {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  name?: string;
  /** Nonce to embed (take it from the authorize URL); override to test mismatches. */
  nonce: string;
  aud?: string;
  iss?: string;
  expOffsetSeconds?: number;
  /** Sign with a key that is not in the JWKS. */
  foreignKey?: boolean;
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  ({ status, body, headers }) satisfies OAuthHttpResponse;

/**
 * In-process stand-in for the Kakao / Naver / Google endpoints. Tests register what a given
 * authorization `code` should resolve to; everything else answers like the real provider would
 * on a bad request. Google id_tokens are really RS256-signed and served through a real JWKS.
 */
export class FakeOAuthHttp implements OAuthHttpClient {
  readonly requests: OAuthHttpRequest[] = [];
  private readonly kakao = new Map<string, KakaoFixture>();
  private readonly naver = new Map<string, NaverFixture>();
  private readonly google = new Map<string, GoogleFixture>();
  private readonly accessTokens = new Map<string, { provider: string; code: string }>();
  private readonly key = generateKeyPairSync('rsa', { modulusLength: 2048 });
  private readonly otherKey = generateKeyPairSync('rsa', { modulusLength: 2048 });
  private readonly kid = 'test-kid-1';
  private seq = 0;

  reset(): void {
    this.requests.length = 0;
    this.kakao.clear();
    this.naver.clear();
    this.google.clear();
    this.accessTokens.clear();
  }

  kakaoCode(code: string, user: KakaoFixture): void {
    this.kakao.set(code, user);
  }

  naverCode(code: string, user: NaverFixture): void {
    this.naver.set(code, user);
  }

  googleCode(code: string, user: GoogleFixture): void {
    this.google.set(code, user);
  }

  async request(req: OAuthHttpRequest): Promise<OAuthHttpResponse> {
    this.requests.push(req);
    const url = req.url.split('?')[0];
    switch (url) {
      case KAKAO_ENDPOINTS.token:
        return this.token('kakao', req, this.kakao);
      case KAKAO_ENDPOINTS.me:
        return this.kakaoMe(req);
      case NAVER_ENDPOINTS.token:
        return this.naverToken(req);
      case NAVER_ENDPOINTS.me:
        return this.naverMe(req);
      case GOOGLE_ENDPOINTS.token:
        return this.googleToken(req);
      case GOOGLE_JWKS_URL:
        return json(
          200,
          {
            keys: [
              {
                ...this.key.publicKey.export({ format: 'jwk' }),
                kid: this.kid,
                use: 'sig',
                alg: 'RS256',
              },
            ],
          },
          { 'cache-control': 'public, max-age=3600' },
        );
      default:
        return json(404, { error: 'not_found' });
    }
  }

  private issueAccessToken(provider: string, code: string): string {
    const token = `at-${provider}-${++this.seq}`;
    this.accessTokens.set(token, { provider, code });
    return token;
  }

  private token<T>(provider: string, req: OAuthHttpRequest, codes: Map<string, T>) {
    const code = req.form?.code ?? '';
    if (req.method !== 'POST' || !codes.has(code)) return json(400, { error: 'invalid_grant' });
    return json(200, { access_token: this.issueAccessToken(provider, code), token_type: 'bearer' });
  }

  private bearer(req: OAuthHttpRequest, provider: string): string | null {
    const token = (req.headers?.Authorization ?? '').replace(/^Bearer /, '');
    const entry = this.accessTokens.get(token);
    return entry && entry.provider === provider ? entry.code : null;
  }

  private kakaoMe(req: OAuthHttpRequest) {
    const code = this.bearer(req, 'kakao');
    const u = code ? this.kakao.get(code) : undefined;
    if (!u) return json(401, { msg: 'this access token does not exist', code: -401 });
    return json(200, {
      id: u.id,
      connected_at: '2026-01-01T00:00:00Z',
      kakao_account: {
        profile: {
          nickname: u.nickname,
          profile_image_url: 'http://k.kakaocdn.net/dn/test/img_640x640.jpg',
          is_default_image: false,
        },
        name: u.name,
        email: u.email,
        is_email_valid: true,
        is_email_verified: true,
        phone_number: u.phone,
      },
    });
  }

  private naverToken(req: OAuthHttpRequest) {
    const code = req.form?.code ?? '';
    if (!this.naver.has(code)) {
      // Naver reports token errors with HTTP 200.
      return json(200, { error: 'invalid_request', error_description: 'no valid data in session' });
    }
    return json(200, { access_token: this.issueAccessToken('naver', code), token_type: 'bearer' });
  }

  private naverMe(req: OAuthHttpRequest) {
    const code = this.bearer(req, 'naver');
    const u = code ? this.naver.get(code) : undefined;
    if (!u) return json(401, { resultcode: '024', message: 'Authentication failed' });
    return json(200, {
      resultcode: '00',
      message: 'success',
      response: {
        id: u.id,
        nickname: u.nickname,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        profile_image: 'https://ssl.pstatic.net/static/pwe/address/img_profile.png',
      },
    });
  }

  private googleToken(req: OAuthHttpRequest) {
    const code = req.form?.code ?? '';
    const u = this.google.get(code);
    if (!u || !req.form?.code_verifier) return json(400, { error: 'invalid_grant' });
    const now = Math.floor(Date.now() / 1000);
    const idToken = this.signJwt(
      {
        iss: u.iss ?? 'https://accounts.google.com',
        aud: u.aud ?? GOOGLE_TEST_CLIENT_ID,
        azp: u.aud ?? GOOGLE_TEST_CLIENT_ID,
        sub: u.sub,
        email: u.email,
        email_verified: u.emailVerified ?? true,
        name: u.name,
        given_name: u.name,
        picture: 'https://lh3.googleusercontent.com/a/test',
        nonce: u.nonce,
        iat: now,
        exp: now + (u.expOffsetSeconds ?? 3600),
      },
      u.foreignKey ? this.otherKey.privateKey : this.key.privateKey,
    );
    return json(200, {
      access_token: this.issueAccessToken('google', code),
      id_token: idToken,
      token_type: 'Bearer',
      expires_in: 3599,
    });
  }

  private signJwt(claims: Record<string, unknown>, key: KeyObject): string {
    const enc = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const head = enc({ alg: 'RS256', kid: this.kid, typ: 'JWT' });
    const body = enc(claims);
    const sig = sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url');
    return `${head}.${body}.${sig}`;
  }
}
